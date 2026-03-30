"use client";
import { useGetMe, useLogin, useLogout, useRegister, getGetMeQueryKey } from "@workspace/api-client-react";
import type { LoginRequest, RegisterRequest } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export function useAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();

  const { data, isLoading, error } = useGetMe({
    query: {
      queryKey: getGetMeQueryKey(),
      retry: false,
      staleTime: Infinity,
    }
  });

  const meData = data as any;
  const user = meData?.user ?? meData;
  const workspace = meData?.workspace ?? null;

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data: any) => {
        queryClient.setQueryData(getGetMeQueryKey(), data);
        toast({ title: "Welcome back!", description: "You have successfully logged in." });
        router.push("/dashboard");
      },
      onError: (err: any) => {
        toast({ 
          title: "Login failed", 
          description: err.message || "Please check your credentials and try again.", 
          variant: "destructive" 
        });
      }
    }
  });

  const registerMutation = useRegister({
    mutation: {
      onSuccess: (data: any) => {
        queryClient.setQueryData(getGetMeQueryKey(), data);
        toast({ title: "Account created!", description: "Check your email to verify your account." });
        router.push("/dashboard");
      },
      onError: (err: any) => {
        toast({ 
          title: "Registration failed", 
          description: err.message || "An error occurred during registration.", 
          variant: "destructive" 
        });
      }
    }
  });

  const logoutMutation = useLogout({
    mutation: {
      onSuccess: () => {
        queryClient.setQueryData(getGetMeQueryKey(), null);
        toast({ title: "Logged out", description: "You have been logged out successfully." });
        router.push("/");
      }
    }
  });

  return {
    user,
    workspace,
    isLoading,
    error,
    login: (data: LoginRequest) => loginMutation.mutate({ data }),
    isLoggingIn: loginMutation.isPending,
    register: (data: RegisterRequest) => registerMutation.mutate({ data }),
    isRegistering: registerMutation.isPending,
    logout: () => logoutMutation.mutate(),
    isLoggingOut: logoutMutation.isPending
  };
}
