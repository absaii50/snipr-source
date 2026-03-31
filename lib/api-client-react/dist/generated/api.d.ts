import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from "@tanstack/react-query";
import type { AiAskRequest, AiAskResponse, AiInsight, AuthResponse, ClickEvent, Conversion, ConversionRow, CreateDomainRequest, CreateFolderRequest, CreateLinkRequest, CreatePixelRequest, CreateTagRequest, Domain, ErrorResponse, Folder, ForgotPasswordRequest, GetAiInsightsParams, GetConversionsParams, GetLinkAnalyticsParams, GetLinkEventsParams, GetLinkTimeseriesParams, GetLinksParams, GetRevenueReportParams, GetWorkspaceAnalyticsParams, GetWorkspaceTimeseriesParams, HealthStatus, InviteMemberRequest, Link, LinkAnalytics, LinkRule, LoginRequest, MessageResponse, Pixel, QrResponse, RegisterRequest, ResetPasswordRequest, RevenueReport, SetLinkRulesBody, SetLinkTagsBody, SlugSuggestRequest, SlugSuggestResponse, Tag, TimeseriesPoint, TrackConversionRequest, UpdateFolderRequest, UpdateLinkRequest, UpdateMemberRequest, UpdatePixelRequest, UpdateTagRequest, UserResponse, WorkspaceAnalytics, WorkspaceMember } from "./api.schemas";
import { customFetch } from "../custom-fetch";
import type { ErrorType, BodyType } from "../custom-fetch";
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
/**
 * @summary Health check
 */
export declare const getHealthCheckUrl: () => string;
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Register a new user
 */
export declare const getRegisterUrl: () => string;
export declare const register: (registerRequest: RegisterRequest, options?: RequestInit) => Promise<AuthResponse>;
export declare const getRegisterMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof register>>, TError, {
        data: BodyType<RegisterRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof register>>, TError, {
    data: BodyType<RegisterRequest>;
}, TContext>;
export type RegisterMutationResult = NonNullable<Awaited<ReturnType<typeof register>>>;
export type RegisterMutationBody = BodyType<RegisterRequest>;
export type RegisterMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Register a new user
 */
export declare const useRegister: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof register>>, TError, {
        data: BodyType<RegisterRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof register>>, TError, {
    data: BodyType<RegisterRequest>;
}, TContext>;
/**
 * @summary Login with email and password
 */
export declare const getLoginUrl: () => string;
export declare const login: (loginRequest: LoginRequest, options?: RequestInit) => Promise<AuthResponse>;
export declare const getLoginMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
        data: BodyType<LoginRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
    data: BodyType<LoginRequest>;
}, TContext>;
export type LoginMutationResult = NonNullable<Awaited<ReturnType<typeof login>>>;
export type LoginMutationBody = BodyType<LoginRequest>;
export type LoginMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Login with email and password
 */
export declare const useLogin: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
        data: BodyType<LoginRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof login>>, TError, {
    data: BodyType<LoginRequest>;
}, TContext>;
/**
 * @summary Request a password reset email
 */
export declare const getForgotPasswordUrl: () => string;
export declare const forgotPassword: (forgotPasswordRequest: ForgotPasswordRequest, options?: RequestInit) => Promise<MessageResponse>;
export declare const getForgotPasswordMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof forgotPassword>>, TError, {
        data: BodyType<ForgotPasswordRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof forgotPassword>>, TError, {
    data: BodyType<ForgotPasswordRequest>;
}, TContext>;
export type ForgotPasswordMutationResult = NonNullable<Awaited<ReturnType<typeof forgotPassword>>>;
export type ForgotPasswordMutationBody = BodyType<ForgotPasswordRequest>;
export type ForgotPasswordMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Request a password reset email
 */
export declare const useForgotPassword: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof forgotPassword>>, TError, {
        data: BodyType<ForgotPasswordRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof forgotPassword>>, TError, {
    data: BodyType<ForgotPasswordRequest>;
}, TContext>;
/**
 * @summary Reset password using token from email
 */
export declare const getResetPasswordUrl: () => string;
export declare const resetPassword: (resetPasswordRequest: ResetPasswordRequest, options?: RequestInit) => Promise<MessageResponse>;
export declare const getResetPasswordMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof resetPassword>>, TError, {
        data: BodyType<ResetPasswordRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof resetPassword>>, TError, {
    data: BodyType<ResetPasswordRequest>;
}, TContext>;
export type ResetPasswordMutationResult = NonNullable<Awaited<ReturnType<typeof resetPassword>>>;
export type ResetPasswordMutationBody = BodyType<ResetPasswordRequest>;
export type ResetPasswordMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Reset password using token from email
 */
export declare const useResetPassword: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof resetPassword>>, TError, {
        data: BodyType<ResetPasswordRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof resetPassword>>, TError, {
    data: BodyType<ResetPasswordRequest>;
}, TContext>;
/**
 * @summary Log out current user
 */
export declare const getLogoutUrl: () => string;
export declare const logout: (options?: RequestInit) => Promise<MessageResponse>;
export declare const getLogoutMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
export type LogoutMutationResult = NonNullable<Awaited<ReturnType<typeof logout>>>;
export type LogoutMutationError = ErrorType<unknown>;
/**
 * @summary Log out current user
 */
export declare const useLogout: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof logout>>, TError, void, TContext>;
/**
 * @summary Get current user
 */
export declare const getGetMeUrl: () => string;
export declare const getMe: (options?: RequestInit) => Promise<UserResponse>;
export declare const getGetMeQueryKey: () => readonly ["/api/auth/me"];
export declare const getGetMeQueryOptions: <TData = Awaited<ReturnType<typeof getMe>>, TError = ErrorType<ErrorResponse>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMe>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMe>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMeQueryResult = NonNullable<Awaited<ReturnType<typeof getMe>>>;
export type GetMeQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get current user
 */
export declare function useGetMe<TData = Awaited<ReturnType<typeof getMe>>, TError = ErrorType<ErrorResponse>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMe>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get all links for current workspace
 */
export declare const getGetLinksUrl: (params?: GetLinksParams) => string;
export declare const getLinks: (params?: GetLinksParams, options?: RequestInit) => Promise<Link[]>;
export declare const getGetLinksQueryKey: (params?: GetLinksParams) => readonly ["/api/links", ...GetLinksParams[]];
export declare const getGetLinksQueryOptions: <TData = Awaited<ReturnType<typeof getLinks>>, TError = ErrorType<ErrorResponse>>(params?: GetLinksParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLinks>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getLinks>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetLinksQueryResult = NonNullable<Awaited<ReturnType<typeof getLinks>>>;
export type GetLinksQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get all links for current workspace
 */
export declare function useGetLinks<TData = Awaited<ReturnType<typeof getLinks>>, TError = ErrorType<ErrorResponse>>(params?: GetLinksParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLinks>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a new short link
 */
export declare const getCreateLinkUrl: () => string;
export declare const createLink: (createLinkRequest: CreateLinkRequest, options?: RequestInit) => Promise<Link>;
export declare const getCreateLinkMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createLink>>, TError, {
        data: BodyType<CreateLinkRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createLink>>, TError, {
    data: BodyType<CreateLinkRequest>;
}, TContext>;
export type CreateLinkMutationResult = NonNullable<Awaited<ReturnType<typeof createLink>>>;
export type CreateLinkMutationBody = BodyType<CreateLinkRequest>;
export type CreateLinkMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Create a new short link
 */
export declare const useCreateLink: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createLink>>, TError, {
        data: BodyType<CreateLinkRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createLink>>, TError, {
    data: BodyType<CreateLinkRequest>;
}, TContext>;
/**
 * @summary Get a link by ID
 */
export declare const getGetLinkUrl: (id: string) => string;
export declare const getLink: (id: string, options?: RequestInit) => Promise<Link>;
export declare const getGetLinkQueryKey: (id: string) => readonly [`/api/links/${string}`];
export declare const getGetLinkQueryOptions: <TData = Awaited<ReturnType<typeof getLink>>, TError = ErrorType<ErrorResponse>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLink>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getLink>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetLinkQueryResult = NonNullable<Awaited<ReturnType<typeof getLink>>>;
export type GetLinkQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get a link by ID
 */
export declare function useGetLink<TData = Awaited<ReturnType<typeof getLink>>, TError = ErrorType<ErrorResponse>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLink>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Update a link
 */
export declare const getUpdateLinkUrl: (id: string) => string;
export declare const updateLink: (id: string, updateLinkRequest: UpdateLinkRequest, options?: RequestInit) => Promise<Link>;
export declare const getUpdateLinkMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateLink>>, TError, {
        id: string;
        data: BodyType<UpdateLinkRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateLink>>, TError, {
    id: string;
    data: BodyType<UpdateLinkRequest>;
}, TContext>;
export type UpdateLinkMutationResult = NonNullable<Awaited<ReturnType<typeof updateLink>>>;
export type UpdateLinkMutationBody = BodyType<UpdateLinkRequest>;
export type UpdateLinkMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Update a link
 */
export declare const useUpdateLink: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateLink>>, TError, {
        id: string;
        data: BodyType<UpdateLinkRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateLink>>, TError, {
    id: string;
    data: BodyType<UpdateLinkRequest>;
}, TContext>;
/**
 * @summary Delete a link
 */
export declare const getDeleteLinkUrl: (id: string) => string;
export declare const deleteLink: (id: string, options?: RequestInit) => Promise<MessageResponse>;
export declare const getDeleteLinkMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteLink>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteLink>>, TError, {
    id: string;
}, TContext>;
export type DeleteLinkMutationResult = NonNullable<Awaited<ReturnType<typeof deleteLink>>>;
export type DeleteLinkMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Delete a link
 */
export declare const useDeleteLink: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteLink>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteLink>>, TError, {
    id: string;
}, TContext>;
/**
 * @summary Get QR code SVG for a link
 */
export declare const getGetLinkQrUrl: (id: string) => string;
export declare const getLinkQr: (id: string, options?: RequestInit) => Promise<QrResponse>;
export declare const getGetLinkQrQueryKey: (id: string) => readonly [`/api/links/${string}/qr`];
export declare const getGetLinkQrQueryOptions: <TData = Awaited<ReturnType<typeof getLinkQr>>, TError = ErrorType<ErrorResponse>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLinkQr>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getLinkQr>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetLinkQrQueryResult = NonNullable<Awaited<ReturnType<typeof getLinkQr>>>;
export type GetLinkQrQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get QR code SVG for a link
 */
export declare function useGetLinkQr<TData = Awaited<ReturnType<typeof getLinkQr>>, TError = ErrorType<ErrorResponse>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLinkQr>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get tags for a link
 */
export declare const getGetLinkTagsUrl: (id: string) => string;
export declare const getLinkTags: (id: string, options?: RequestInit) => Promise<Tag[]>;
export declare const getGetLinkTagsQueryKey: (id: string) => readonly [`/api/links/${string}/tags`];
export declare const getGetLinkTagsQueryOptions: <TData = Awaited<ReturnType<typeof getLinkTags>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLinkTags>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getLinkTags>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetLinkTagsQueryResult = NonNullable<Awaited<ReturnType<typeof getLinkTags>>>;
export type GetLinkTagsQueryError = ErrorType<unknown>;
/**
 * @summary Get tags for a link
 */
export declare function useGetLinkTags<TData = Awaited<ReturnType<typeof getLinkTags>>, TError = ErrorType<unknown>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLinkTags>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Set tags for a link (replaces all existing)
 */
export declare const getSetLinkTagsUrl: (id: string) => string;
export declare const setLinkTags: (id: string, setLinkTagsBody: SetLinkTagsBody, options?: RequestInit) => Promise<MessageResponse>;
export declare const getSetLinkTagsMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof setLinkTags>>, TError, {
        id: string;
        data: BodyType<SetLinkTagsBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof setLinkTags>>, TError, {
    id: string;
    data: BodyType<SetLinkTagsBody>;
}, TContext>;
export type SetLinkTagsMutationResult = NonNullable<Awaited<ReturnType<typeof setLinkTags>>>;
export type SetLinkTagsMutationBody = BodyType<SetLinkTagsBody>;
export type SetLinkTagsMutationError = ErrorType<unknown>;
/**
 * @summary Set tags for a link (replaces all existing)
 */
export declare const useSetLinkTags: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof setLinkTags>>, TError, {
        id: string;
        data: BodyType<SetLinkTagsBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof setLinkTags>>, TError, {
    id: string;
    data: BodyType<SetLinkTagsBody>;
}, TContext>;
/**
 * @summary Get routing rules for a link
 */
export declare const getGetLinkRulesUrl: (id: string) => string;
export declare const getLinkRules: (id: string, options?: RequestInit) => Promise<LinkRule[]>;
export declare const getGetLinkRulesQueryKey: (id: string) => readonly [`/api/links/${string}/rules`];
export declare const getGetLinkRulesQueryOptions: <TData = Awaited<ReturnType<typeof getLinkRules>>, TError = ErrorType<ErrorResponse>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLinkRules>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getLinkRules>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetLinkRulesQueryResult = NonNullable<Awaited<ReturnType<typeof getLinkRules>>>;
export type GetLinkRulesQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get routing rules for a link
 */
export declare function useGetLinkRules<TData = Awaited<ReturnType<typeof getLinkRules>>, TError = ErrorType<ErrorResponse>>(id: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLinkRules>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Set routing rules for a link (replaces all existing)
 */
export declare const getSetLinkRulesUrl: (id: string) => string;
export declare const setLinkRules: (id: string, setLinkRulesBody: SetLinkRulesBody, options?: RequestInit) => Promise<LinkRule[]>;
export declare const getSetLinkRulesMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof setLinkRules>>, TError, {
        id: string;
        data: BodyType<SetLinkRulesBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof setLinkRules>>, TError, {
    id: string;
    data: BodyType<SetLinkRulesBody>;
}, TContext>;
export type SetLinkRulesMutationResult = NonNullable<Awaited<ReturnType<typeof setLinkRules>>>;
export type SetLinkRulesMutationBody = BodyType<SetLinkRulesBody>;
export type SetLinkRulesMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Set routing rules for a link (replaces all existing)
 */
export declare const useSetLinkRules: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof setLinkRules>>, TError, {
        id: string;
        data: BodyType<SetLinkRulesBody>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof setLinkRules>>, TError, {
    id: string;
    data: BodyType<SetLinkRulesBody>;
}, TContext>;
/**
 * @summary Get all custom domains for workspace
 */
export declare const getGetDomainsUrl: () => string;
export declare const getDomains: (options?: RequestInit) => Promise<Domain[]>;
export declare const getGetDomainsQueryKey: () => readonly ["/api/domains"];
export declare const getGetDomainsQueryOptions: <TData = Awaited<ReturnType<typeof getDomains>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDomains>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDomains>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDomainsQueryResult = NonNullable<Awaited<ReturnType<typeof getDomains>>>;
export type GetDomainsQueryError = ErrorType<unknown>;
/**
 * @summary Get all custom domains for workspace
 */
export declare function useGetDomains<TData = Awaited<ReturnType<typeof getDomains>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDomains>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Add a custom domain
 */
export declare const getCreateDomainUrl: () => string;
export declare const createDomain: (createDomainRequest: CreateDomainRequest, options?: RequestInit) => Promise<Domain>;
export declare const getCreateDomainMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createDomain>>, TError, {
        data: BodyType<CreateDomainRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createDomain>>, TError, {
    data: BodyType<CreateDomainRequest>;
}, TContext>;
export type CreateDomainMutationResult = NonNullable<Awaited<ReturnType<typeof createDomain>>>;
export type CreateDomainMutationBody = BodyType<CreateDomainRequest>;
export type CreateDomainMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Add a custom domain
 */
export declare const useCreateDomain: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createDomain>>, TError, {
        data: BodyType<CreateDomainRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createDomain>>, TError, {
    data: BodyType<CreateDomainRequest>;
}, TContext>;
/**
 * @summary Remove a custom domain
 */
export declare const getDeleteDomainUrl: (id: string) => string;
export declare const deleteDomain: (id: string, options?: RequestInit) => Promise<MessageResponse>;
export declare const getDeleteDomainMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteDomain>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteDomain>>, TError, {
    id: string;
}, TContext>;
export type DeleteDomainMutationResult = NonNullable<Awaited<ReturnType<typeof deleteDomain>>>;
export type DeleteDomainMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Remove a custom domain
 */
export declare const useDeleteDomain: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteDomain>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteDomain>>, TError, {
    id: string;
}, TContext>;
/**
 * @summary Get all retargeting pixels for workspace
 */
export declare const getGetPixelsUrl: () => string;
export declare const getPixels: (options?: RequestInit) => Promise<Pixel[]>;
export declare const getGetPixelsQueryKey: () => readonly ["/api/pixels"];
export declare const getGetPixelsQueryOptions: <TData = Awaited<ReturnType<typeof getPixels>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPixels>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPixels>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPixelsQueryResult = NonNullable<Awaited<ReturnType<typeof getPixels>>>;
export type GetPixelsQueryError = ErrorType<unknown>;
/**
 * @summary Get all retargeting pixels for workspace
 */
export declare function useGetPixels<TData = Awaited<ReturnType<typeof getPixels>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPixels>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Add a retargeting pixel
 */
export declare const getCreatePixelUrl: () => string;
export declare const createPixel: (createPixelRequest: CreatePixelRequest, options?: RequestInit) => Promise<Pixel>;
export declare const getCreatePixelMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPixel>>, TError, {
        data: BodyType<CreatePixelRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createPixel>>, TError, {
    data: BodyType<CreatePixelRequest>;
}, TContext>;
export type CreatePixelMutationResult = NonNullable<Awaited<ReturnType<typeof createPixel>>>;
export type CreatePixelMutationBody = BodyType<CreatePixelRequest>;
export type CreatePixelMutationError = ErrorType<unknown>;
/**
 * @summary Add a retargeting pixel
 */
export declare const useCreatePixel: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createPixel>>, TError, {
        data: BodyType<CreatePixelRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createPixel>>, TError, {
    data: BodyType<CreatePixelRequest>;
}, TContext>;
/**
 * @summary Update a retargeting pixel
 */
export declare const getUpdatePixelUrl: (id: string) => string;
export declare const updatePixel: (id: string, updatePixelRequest: UpdatePixelRequest, options?: RequestInit) => Promise<Pixel>;
export declare const getUpdatePixelMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePixel>>, TError, {
        id: string;
        data: BodyType<UpdatePixelRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updatePixel>>, TError, {
    id: string;
    data: BodyType<UpdatePixelRequest>;
}, TContext>;
export type UpdatePixelMutationResult = NonNullable<Awaited<ReturnType<typeof updatePixel>>>;
export type UpdatePixelMutationBody = BodyType<UpdatePixelRequest>;
export type UpdatePixelMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Update a retargeting pixel
 */
export declare const useUpdatePixel: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updatePixel>>, TError, {
        id: string;
        data: BodyType<UpdatePixelRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updatePixel>>, TError, {
    id: string;
    data: BodyType<UpdatePixelRequest>;
}, TContext>;
/**
 * @summary Remove a retargeting pixel
 */
export declare const getDeletePixelUrl: (id: string) => string;
export declare const deletePixel: (id: string, options?: RequestInit) => Promise<MessageResponse>;
export declare const getDeletePixelMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePixel>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deletePixel>>, TError, {
    id: string;
}, TContext>;
export type DeletePixelMutationResult = NonNullable<Awaited<ReturnType<typeof deletePixel>>>;
export type DeletePixelMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Remove a retargeting pixel
 */
export declare const useDeletePixel: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deletePixel>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deletePixel>>, TError, {
    id: string;
}, TContext>;
/**
 * @summary Get all tags for workspace
 */
export declare const getGetTagsUrl: () => string;
export declare const getTags: (options?: RequestInit) => Promise<Tag[]>;
export declare const getGetTagsQueryKey: () => readonly ["/api/tags"];
export declare const getGetTagsQueryOptions: <TData = Awaited<ReturnType<typeof getTags>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTags>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getTags>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetTagsQueryResult = NonNullable<Awaited<ReturnType<typeof getTags>>>;
export type GetTagsQueryError = ErrorType<unknown>;
/**
 * @summary Get all tags for workspace
 */
export declare function useGetTags<TData = Awaited<ReturnType<typeof getTags>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTags>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a tag
 */
export declare const getCreateTagUrl: () => string;
export declare const createTag: (createTagRequest: CreateTagRequest, options?: RequestInit) => Promise<Tag>;
export declare const getCreateTagMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createTag>>, TError, {
        data: BodyType<CreateTagRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createTag>>, TError, {
    data: BodyType<CreateTagRequest>;
}, TContext>;
export type CreateTagMutationResult = NonNullable<Awaited<ReturnType<typeof createTag>>>;
export type CreateTagMutationBody = BodyType<CreateTagRequest>;
export type CreateTagMutationError = ErrorType<unknown>;
/**
 * @summary Create a tag
 */
export declare const useCreateTag: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createTag>>, TError, {
        data: BodyType<CreateTagRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createTag>>, TError, {
    data: BodyType<CreateTagRequest>;
}, TContext>;
/**
 * @summary Update a tag
 */
export declare const getUpdateTagUrl: (id: string) => string;
export declare const updateTag: (id: string, updateTagRequest: UpdateTagRequest, options?: RequestInit) => Promise<Tag>;
export declare const getUpdateTagMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTag>>, TError, {
        id: string;
        data: BodyType<UpdateTagRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateTag>>, TError, {
    id: string;
    data: BodyType<UpdateTagRequest>;
}, TContext>;
export type UpdateTagMutationResult = NonNullable<Awaited<ReturnType<typeof updateTag>>>;
export type UpdateTagMutationBody = BodyType<UpdateTagRequest>;
export type UpdateTagMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Update a tag
 */
export declare const useUpdateTag: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTag>>, TError, {
        id: string;
        data: BodyType<UpdateTagRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateTag>>, TError, {
    id: string;
    data: BodyType<UpdateTagRequest>;
}, TContext>;
/**
 * @summary Delete a tag
 */
export declare const getDeleteTagUrl: (id: string) => string;
export declare const deleteTag: (id: string, options?: RequestInit) => Promise<MessageResponse>;
export declare const getDeleteTagMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteTag>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteTag>>, TError, {
    id: string;
}, TContext>;
export type DeleteTagMutationResult = NonNullable<Awaited<ReturnType<typeof deleteTag>>>;
export type DeleteTagMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Delete a tag
 */
export declare const useDeleteTag: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteTag>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteTag>>, TError, {
    id: string;
}, TContext>;
/**
 * @summary Get all folders for workspace
 */
export declare const getGetFoldersUrl: () => string;
export declare const getFolders: (options?: RequestInit) => Promise<Folder[]>;
export declare const getGetFoldersQueryKey: () => readonly ["/api/folders"];
export declare const getGetFoldersQueryOptions: <TData = Awaited<ReturnType<typeof getFolders>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFolders>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getFolders>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetFoldersQueryResult = NonNullable<Awaited<ReturnType<typeof getFolders>>>;
export type GetFoldersQueryError = ErrorType<unknown>;
/**
 * @summary Get all folders for workspace
 */
export declare function useGetFolders<TData = Awaited<ReturnType<typeof getFolders>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getFolders>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Create a folder
 */
export declare const getCreateFolderUrl: () => string;
export declare const createFolder: (createFolderRequest: CreateFolderRequest, options?: RequestInit) => Promise<Folder>;
export declare const getCreateFolderMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createFolder>>, TError, {
        data: BodyType<CreateFolderRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createFolder>>, TError, {
    data: BodyType<CreateFolderRequest>;
}, TContext>;
export type CreateFolderMutationResult = NonNullable<Awaited<ReturnType<typeof createFolder>>>;
export type CreateFolderMutationBody = BodyType<CreateFolderRequest>;
export type CreateFolderMutationError = ErrorType<unknown>;
/**
 * @summary Create a folder
 */
export declare const useCreateFolder: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createFolder>>, TError, {
        data: BodyType<CreateFolderRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createFolder>>, TError, {
    data: BodyType<CreateFolderRequest>;
}, TContext>;
/**
 * @summary Update a folder
 */
export declare const getUpdateFolderUrl: (id: string) => string;
export declare const updateFolder: (id: string, updateFolderRequest: UpdateFolderRequest, options?: RequestInit) => Promise<Folder>;
export declare const getUpdateFolderMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateFolder>>, TError, {
        id: string;
        data: BodyType<UpdateFolderRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateFolder>>, TError, {
    id: string;
    data: BodyType<UpdateFolderRequest>;
}, TContext>;
export type UpdateFolderMutationResult = NonNullable<Awaited<ReturnType<typeof updateFolder>>>;
export type UpdateFolderMutationBody = BodyType<UpdateFolderRequest>;
export type UpdateFolderMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Update a folder
 */
export declare const useUpdateFolder: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateFolder>>, TError, {
        id: string;
        data: BodyType<UpdateFolderRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateFolder>>, TError, {
    id: string;
    data: BodyType<UpdateFolderRequest>;
}, TContext>;
/**
 * @summary Delete a folder
 */
export declare const getDeleteFolderUrl: (id: string) => string;
export declare const deleteFolder: (id: string, options?: RequestInit) => Promise<MessageResponse>;
export declare const getDeleteFolderMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteFolder>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteFolder>>, TError, {
    id: string;
}, TContext>;
export type DeleteFolderMutationResult = NonNullable<Awaited<ReturnType<typeof deleteFolder>>>;
export type DeleteFolderMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Delete a folder
 */
export declare const useDeleteFolder: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteFolder>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteFolder>>, TError, {
    id: string;
}, TContext>;
/**
 * @summary Get workspace-level analytics overview
 */
export declare const getGetWorkspaceAnalyticsUrl: (params?: GetWorkspaceAnalyticsParams) => string;
export declare const getWorkspaceAnalytics: (params?: GetWorkspaceAnalyticsParams, options?: RequestInit) => Promise<WorkspaceAnalytics>;
export declare const getGetWorkspaceAnalyticsQueryKey: (params?: GetWorkspaceAnalyticsParams) => readonly ["/api/analytics/workspace", ...GetWorkspaceAnalyticsParams[]];
export declare const getGetWorkspaceAnalyticsQueryOptions: <TData = Awaited<ReturnType<typeof getWorkspaceAnalytics>>, TError = ErrorType<ErrorResponse>>(params?: GetWorkspaceAnalyticsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getWorkspaceAnalytics>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getWorkspaceAnalytics>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetWorkspaceAnalyticsQueryResult = NonNullable<Awaited<ReturnType<typeof getWorkspaceAnalytics>>>;
export type GetWorkspaceAnalyticsQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get workspace-level analytics overview
 */
export declare function useGetWorkspaceAnalytics<TData = Awaited<ReturnType<typeof getWorkspaceAnalytics>>, TError = ErrorType<ErrorResponse>>(params?: GetWorkspaceAnalyticsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getWorkspaceAnalytics>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get workspace click timeseries
 */
export declare const getGetWorkspaceTimeseriesUrl: (params?: GetWorkspaceTimeseriesParams) => string;
export declare const getWorkspaceTimeseries: (params?: GetWorkspaceTimeseriesParams, options?: RequestInit) => Promise<TimeseriesPoint[]>;
export declare const getGetWorkspaceTimeseriesQueryKey: (params?: GetWorkspaceTimeseriesParams) => readonly ["/api/analytics/workspace/timeseries", ...GetWorkspaceTimeseriesParams[]];
export declare const getGetWorkspaceTimeseriesQueryOptions: <TData = Awaited<ReturnType<typeof getWorkspaceTimeseries>>, TError = ErrorType<ErrorResponse>>(params?: GetWorkspaceTimeseriesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getWorkspaceTimeseries>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getWorkspaceTimeseries>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetWorkspaceTimeseriesQueryResult = NonNullable<Awaited<ReturnType<typeof getWorkspaceTimeseries>>>;
export type GetWorkspaceTimeseriesQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get workspace click timeseries
 */
export declare function useGetWorkspaceTimeseries<TData = Awaited<ReturnType<typeof getWorkspaceTimeseries>>, TError = ErrorType<ErrorResponse>>(params?: GetWorkspaceTimeseriesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getWorkspaceTimeseries>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get analytics for a specific link
 */
export declare const getGetLinkAnalyticsUrl: (id: string, params?: GetLinkAnalyticsParams) => string;
export declare const getLinkAnalytics: (id: string, params?: GetLinkAnalyticsParams, options?: RequestInit) => Promise<LinkAnalytics>;
export declare const getGetLinkAnalyticsQueryKey: (id: string, params?: GetLinkAnalyticsParams) => readonly [`/api/analytics/links/${string}`, ...GetLinkAnalyticsParams[]];
export declare const getGetLinkAnalyticsQueryOptions: <TData = Awaited<ReturnType<typeof getLinkAnalytics>>, TError = ErrorType<ErrorResponse>>(id: string, params?: GetLinkAnalyticsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLinkAnalytics>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getLinkAnalytics>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetLinkAnalyticsQueryResult = NonNullable<Awaited<ReturnType<typeof getLinkAnalytics>>>;
export type GetLinkAnalyticsQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get analytics for a specific link
 */
export declare function useGetLinkAnalytics<TData = Awaited<ReturnType<typeof getLinkAnalytics>>, TError = ErrorType<ErrorResponse>>(id: string, params?: GetLinkAnalyticsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLinkAnalytics>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get click timeseries for a specific link
 */
export declare const getGetLinkTimeseriesUrl: (id: string, params?: GetLinkTimeseriesParams) => string;
export declare const getLinkTimeseries: (id: string, params?: GetLinkTimeseriesParams, options?: RequestInit) => Promise<TimeseriesPoint[]>;
export declare const getGetLinkTimeseriesQueryKey: (id: string, params?: GetLinkTimeseriesParams) => readonly [`/api/analytics/links/${string}/timeseries`, ...GetLinkTimeseriesParams[]];
export declare const getGetLinkTimeseriesQueryOptions: <TData = Awaited<ReturnType<typeof getLinkTimeseries>>, TError = ErrorType<ErrorResponse>>(id: string, params?: GetLinkTimeseriesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLinkTimeseries>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getLinkTimeseries>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetLinkTimeseriesQueryResult = NonNullable<Awaited<ReturnType<typeof getLinkTimeseries>>>;
export type GetLinkTimeseriesQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get click timeseries for a specific link
 */
export declare function useGetLinkTimeseries<TData = Awaited<ReturnType<typeof getLinkTimeseries>>, TError = ErrorType<ErrorResponse>>(id: string, params?: GetLinkTimeseriesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLinkTimeseries>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Get recent click events for a link
 */
export declare const getGetLinkEventsUrl: (id: string, params?: GetLinkEventsParams) => string;
export declare const getLinkEvents: (id: string, params?: GetLinkEventsParams, options?: RequestInit) => Promise<ClickEvent[]>;
export declare const getGetLinkEventsQueryKey: (id: string, params?: GetLinkEventsParams) => readonly [`/api/analytics/links/${string}/events`, ...GetLinkEventsParams[]];
export declare const getGetLinkEventsQueryOptions: <TData = Awaited<ReturnType<typeof getLinkEvents>>, TError = ErrorType<ErrorResponse>>(id: string, params?: GetLinkEventsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLinkEvents>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getLinkEvents>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetLinkEventsQueryResult = NonNullable<Awaited<ReturnType<typeof getLinkEvents>>>;
export type GetLinkEventsQueryError = ErrorType<ErrorResponse>;
/**
 * @summary Get recent click events for a link
 */
export declare function useGetLinkEvents<TData = Awaited<ReturnType<typeof getLinkEvents>>, TError = ErrorType<ErrorResponse>>(id: string, params?: GetLinkEventsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getLinkEvents>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Track a conversion event
 */
export declare const getTrackConversionUrl: () => string;
export declare const trackConversion: (trackConversionRequest: TrackConversionRequest, options?: RequestInit) => Promise<Conversion>;
export declare const getTrackConversionMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof trackConversion>>, TError, {
        data: BodyType<TrackConversionRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof trackConversion>>, TError, {
    data: BodyType<TrackConversionRequest>;
}, TContext>;
export type TrackConversionMutationResult = NonNullable<Awaited<ReturnType<typeof trackConversion>>>;
export type TrackConversionMutationBody = BodyType<TrackConversionRequest>;
export type TrackConversionMutationError = ErrorType<unknown>;
/**
 * @summary Track a conversion event
 */
export declare const useTrackConversion: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof trackConversion>>, TError, {
        data: BodyType<TrackConversionRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof trackConversion>>, TError, {
    data: BodyType<TrackConversionRequest>;
}, TContext>;
/**
 * @summary List workspace conversions
 */
export declare const getGetConversionsUrl: (params?: GetConversionsParams) => string;
export declare const getConversions: (params?: GetConversionsParams, options?: RequestInit) => Promise<ConversionRow[]>;
export declare const getGetConversionsQueryKey: (params?: GetConversionsParams) => readonly ["/api/conversions", ...GetConversionsParams[]];
export declare const getGetConversionsQueryOptions: <TData = Awaited<ReturnType<typeof getConversions>>, TError = ErrorType<unknown>>(params?: GetConversionsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getConversions>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getConversions>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetConversionsQueryResult = NonNullable<Awaited<ReturnType<typeof getConversions>>>;
export type GetConversionsQueryError = ErrorType<unknown>;
/**
 * @summary List workspace conversions
 */
export declare function useGetConversions<TData = Awaited<ReturnType<typeof getConversions>>, TError = ErrorType<unknown>>(params?: GetConversionsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getConversions>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Revenue and conversion analytics by link and campaign
 */
export declare const getGetRevenueReportUrl: (params?: GetRevenueReportParams) => string;
export declare const getRevenueReport: (params?: GetRevenueReportParams, options?: RequestInit) => Promise<RevenueReport>;
export declare const getGetRevenueReportQueryKey: (params?: GetRevenueReportParams) => readonly ["/api/conversions/revenue", ...GetRevenueReportParams[]];
export declare const getGetRevenueReportQueryOptions: <TData = Awaited<ReturnType<typeof getRevenueReport>>, TError = ErrorType<unknown>>(params?: GetRevenueReportParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getRevenueReport>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getRevenueReport>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetRevenueReportQueryResult = NonNullable<Awaited<ReturnType<typeof getRevenueReport>>>;
export type GetRevenueReportQueryError = ErrorType<unknown>;
/**
 * @summary Revenue and conversion analytics by link and campaign
 */
export declare function useGetRevenueReport<TData = Awaited<ReturnType<typeof getRevenueReport>>, TError = ErrorType<unknown>>(params?: GetRevenueReportParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getRevenueReport>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary List workspace members
 */
export declare const getGetTeamUrl: () => string;
export declare const getTeam: (options?: RequestInit) => Promise<WorkspaceMember[]>;
export declare const getGetTeamQueryKey: () => readonly ["/api/team"];
export declare const getGetTeamQueryOptions: <TData = Awaited<ReturnType<typeof getTeam>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTeam>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getTeam>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetTeamQueryResult = NonNullable<Awaited<ReturnType<typeof getTeam>>>;
export type GetTeamQueryError = ErrorType<unknown>;
/**
 * @summary List workspace members
 */
export declare function useGetTeam<TData = Awaited<ReturnType<typeof getTeam>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTeam>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Invite a team member
 */
export declare const getInviteTeamMemberUrl: () => string;
export declare const inviteTeamMember: (inviteMemberRequest: InviteMemberRequest, options?: RequestInit) => Promise<WorkspaceMember>;
export declare const getInviteTeamMemberMutationOptions: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof inviteTeamMember>>, TError, {
        data: BodyType<InviteMemberRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof inviteTeamMember>>, TError, {
    data: BodyType<InviteMemberRequest>;
}, TContext>;
export type InviteTeamMemberMutationResult = NonNullable<Awaited<ReturnType<typeof inviteTeamMember>>>;
export type InviteTeamMemberMutationBody = BodyType<InviteMemberRequest>;
export type InviteTeamMemberMutationError = ErrorType<ErrorResponse>;
/**
 * @summary Invite a team member
 */
export declare const useInviteTeamMember: <TError = ErrorType<ErrorResponse>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof inviteTeamMember>>, TError, {
        data: BodyType<InviteMemberRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof inviteTeamMember>>, TError, {
    data: BodyType<InviteMemberRequest>;
}, TContext>;
/**
 * @summary Update member role
 */
export declare const getUpdateTeamMemberUrl: (id: string) => string;
export declare const updateTeamMember: (id: string, updateMemberRequest: UpdateMemberRequest, options?: RequestInit) => Promise<WorkspaceMember>;
export declare const getUpdateTeamMemberMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTeamMember>>, TError, {
        id: string;
        data: BodyType<UpdateMemberRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateTeamMember>>, TError, {
    id: string;
    data: BodyType<UpdateMemberRequest>;
}, TContext>;
export type UpdateTeamMemberMutationResult = NonNullable<Awaited<ReturnType<typeof updateTeamMember>>>;
export type UpdateTeamMemberMutationBody = BodyType<UpdateMemberRequest>;
export type UpdateTeamMemberMutationError = ErrorType<unknown>;
/**
 * @summary Update member role
 */
export declare const useUpdateTeamMember: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTeamMember>>, TError, {
        id: string;
        data: BodyType<UpdateMemberRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateTeamMember>>, TError, {
    id: string;
    data: BodyType<UpdateMemberRequest>;
}, TContext>;
/**
 * @summary Remove a team member
 */
export declare const getRemoveTeamMemberUrl: (id: string) => string;
export declare const removeTeamMember: (id: string, options?: RequestInit) => Promise<MessageResponse>;
export declare const getRemoveTeamMemberMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removeTeamMember>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof removeTeamMember>>, TError, {
    id: string;
}, TContext>;
export type RemoveTeamMemberMutationResult = NonNullable<Awaited<ReturnType<typeof removeTeamMember>>>;
export type RemoveTeamMemberMutationError = ErrorType<unknown>;
/**
 * @summary Remove a team member
 */
export declare const useRemoveTeamMember: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof removeTeamMember>>, TError, {
        id: string;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof removeTeamMember>>, TError, {
    id: string;
}, TContext>;
/**
 * @summary List AI insights for workspace
 */
export declare const getGetAiInsightsUrl: (params?: GetAiInsightsParams) => string;
export declare const getAiInsights: (params?: GetAiInsightsParams, options?: RequestInit) => Promise<AiInsight[]>;
export declare const getGetAiInsightsQueryKey: (params?: GetAiInsightsParams) => readonly ["/api/ai/insights", ...GetAiInsightsParams[]];
export declare const getGetAiInsightsQueryOptions: <TData = Awaited<ReturnType<typeof getAiInsights>>, TError = ErrorType<unknown>>(params?: GetAiInsightsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAiInsights>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAiInsights>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAiInsightsQueryResult = NonNullable<Awaited<ReturnType<typeof getAiInsights>>>;
export type GetAiInsightsQueryError = ErrorType<unknown>;
/**
 * @summary List AI insights for workspace
 */
export declare function useGetAiInsights<TData = Awaited<ReturnType<typeof getAiInsights>>, TError = ErrorType<unknown>>(params?: GetAiInsightsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAiInsights>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
/**
 * @summary Generate an AI weekly performance summary
 */
export declare const getGenerateWeeklySummaryUrl: () => string;
export declare const generateWeeklySummary: (options?: RequestInit) => Promise<AiInsight>;
export declare const getGenerateWeeklySummaryMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateWeeklySummary>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof generateWeeklySummary>>, TError, void, TContext>;
export type GenerateWeeklySummaryMutationResult = NonNullable<Awaited<ReturnType<typeof generateWeeklySummary>>>;
export type GenerateWeeklySummaryMutationError = ErrorType<unknown>;
/**
 * @summary Generate an AI weekly performance summary
 */
export declare const useGenerateWeeklySummary: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof generateWeeklySummary>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof generateWeeklySummary>>, TError, void, TContext>;
/**
 * @summary Ask an analytics question
 */
export declare const getAskAiUrl: () => string;
export declare const askAi: (aiAskRequest: AiAskRequest, options?: RequestInit) => Promise<AiAskResponse>;
export declare const getAskAiMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof askAi>>, TError, {
        data: BodyType<AiAskRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof askAi>>, TError, {
    data: BodyType<AiAskRequest>;
}, TContext>;
export type AskAiMutationResult = NonNullable<Awaited<ReturnType<typeof askAi>>>;
export type AskAiMutationBody = BodyType<AiAskRequest>;
export type AskAiMutationError = ErrorType<unknown>;
/**
 * @summary Ask an analytics question
 */
export declare const useAskAi: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof askAi>>, TError, {
        data: BodyType<AiAskRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof askAi>>, TError, {
    data: BodyType<AiAskRequest>;
}, TContext>;
/**
 * @summary Suggest short link slugs using AI
 */
export declare const getSuggestSlugsUrl: () => string;
export declare const suggestSlugs: (slugSuggestRequest: SlugSuggestRequest, options?: RequestInit) => Promise<SlugSuggestResponse>;
export declare const getSuggestSlugsMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof suggestSlugs>>, TError, {
        data: BodyType<SlugSuggestRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof suggestSlugs>>, TError, {
    data: BodyType<SlugSuggestRequest>;
}, TContext>;
export type SuggestSlugsMutationResult = NonNullable<Awaited<ReturnType<typeof suggestSlugs>>>;
export type SuggestSlugsMutationBody = BodyType<SlugSuggestRequest>;
export type SuggestSlugsMutationError = ErrorType<unknown>;
/**
 * @summary Suggest short link slugs using AI
 */
export declare const useSuggestSlugs: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof suggestSlugs>>, TError, {
        data: BodyType<SlugSuggestRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof suggestSlugs>>, TError, {
    data: BodyType<SlugSuggestRequest>;
}, TContext>;
export {};
//# sourceMappingURL=api.d.ts.map