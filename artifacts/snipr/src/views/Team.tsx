"use client";
import { useState, type FormEvent } from "react";
import { ProtectedLayout } from "@/components/layout/ProtectedLayout";
import { useGetTeam, useInviteTeamMember, useUpdateTeamMember, useRemoveTeamMember, getGetTeamQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Users, Mail, Shield, UserPlus, Trash2, CheckCircle2 } from "lucide-react";

export default function Team() {
  const { user: currentUser } = useAuth();
  const { data: members, isLoading } = useGetTeam();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");

  const inviteMutation = useInviteTeamMember();
  const updateMutation = useUpdateTeamMember();
  const removeMutation = useRemoveTeamMember();

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    try {
      await inviteMutation.mutateAsync({ data: { email: inviteEmail, role: inviteRole as any } });
      toast({ title: "Invitation sent!" });
      setInviteEmail("");
      setShowInvite(false);
      queryClient.invalidateQueries({ queryKey: getGetTeamQueryKey() });
    } catch (err: any) {
      toast({ title: "Failed to invite", description: err.message, variant: "destructive" });
    }
  };

  const handleRoleChange = async (id: string, newRole: string) => {
    try {
      await updateMutation.mutateAsync({ id, data: { role: newRole as any } });
      toast({ title: "Role updated" });
      queryClient.invalidateQueries({ queryKey: getGetTeamQueryKey() });
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  };

  const handleRemove = async (id: string) => {
    if (!window.confirm("Are you sure you want to remove this member?")) return;
    try {
      await removeMutation.mutateAsync({ id });
      toast({ title: "Member removed" });
      queryClient.invalidateQueries({ queryKey: getGetTeamQueryKey() });
    } catch (err: any) {
      toast({ title: "Removal failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <ProtectedLayout>
      <div className="p-8 pt-14 lg:pt-8 max-w-5xl mx-auto w-full animate-fade-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)" }}>
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-[28px] font-[family-name:var(--font-space-grotesk)] font-extrabold tracking-[-0.02em] text-[#FAFAFA]">Team Members</h1>
              <p className="text-[13px] text-[#A1A1AA] mt-1">Manage who has access to this workspace.</p>
            </div>
          </div>
          <button onClick={() => setShowInvite(!showInvite)} className="rounded-lg h-11 px-6 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)" }}>
            <UserPlus className="w-4 h-4" /> Invite Member
          </button>
        </div>

        {showInvite && (
          <div className="mb-8 p-6 animate-in slide-in-from-top-4 fade-in bg-[#18181B] border border-[#8B5CF6]/15 rounded-xl">
            <h3 className="font-semibold mb-4 flex items-center gap-2 text-[#8B5CF6]">
              <Mail className="w-5 h-5" /> Send Invitation
            </h3>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="space-y-2 w-full sm:flex-1">
                <label className="text-[12px] font-semibold text-[#71717A]">Email Address</label>
                <Input
                  type="email"
                  required
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="rounded-lg h-11 bg-[#09090B] border-[#27272A] text-[#E4E4E7] focus:border-[#8B5CF6]/40 focus:ring-2 focus:ring-[#8B5CF6]/10"
                />
              </div>
              <div className="space-y-2 w-full sm:w-48">
                <label className="text-[12px] font-semibold text-[#71717A]">Role</label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="rounded-lg h-11 bg-[#09090B] border-[#27272A] text-[#E4E4E7]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button type="button" variant="ghost" onClick={() => setShowInvite(false)} className="rounded-lg h-11 w-full sm:w-auto text-[#A1A1AA]">Cancel</Button>
                <button type="submit" disabled={inviteMutation.isPending} className="rounded-lg h-11 px-6 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 w-full sm:w-auto disabled:opacity-50" style={{ background: "linear-gradient(135deg, #8B5CF6, #7C3AED)" }}>
                  {inviteMutation.isPending ? "Sending..." : "Send Invite"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="overflow-hidden mb-12 bg-[#18181B] border border-[#27272A] rounded-xl">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-[#18181B] border-b border-[#27272A]">
                <th className="px-6 py-4 text-[#A1A1AA] font-semibold">User</th>
                <th className="px-6 py-4 text-[#A1A1AA] font-semibold">Status</th>
                <th className="px-6 py-4 text-[#A1A1AA] font-semibold">Role</th>
                <th className="px-6 py-4 text-right text-[#A1A1AA] font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#27272A]">
              {isLoading ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-[#A1A1AA]">Loading members...</td></tr>
              ) : members?.map(member => {
                const isMe = member.userId === currentUser?.id;
                return (
                  <tr key={member.id} className="transition-colors group hover:bg-[#27272A]/50 border-b border-[#27272A]">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-[#FAFAFA] flex items-center gap-2">
                        {member.name || "Pending User"}
                        {isMe && <Badge variant="secondary" className="text-xs font-normal">You</Badge>}
                      </div>
                      <div className="text-[#A1A1AA]">{member.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      {member.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-[#34D399] bg-[#10B981]/10">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : member.status === 'invited' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-[#FB923C] bg-[#F59E0B]/10">
                          <Mail className="w-3.5 h-3.5" /> Invited
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-[#A1A1AA] bg-[#27272A]">
                          Removed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Select
                        disabled={isMe || member.role === 'owner'}
                        value={member.role}
                        onValueChange={(val) => handleRoleChange(member.id, val)}
                      >
                        <SelectTrigger className="w-32 h-9 rounded-lg bg-transparent border-transparent hover:border-[#8B5CF6]/30 focus:border-[#8B5CF6] transition-all text-[#E4E4E7]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {member.role === 'owner' && <SelectItem value="owner">Owner</SelectItem>}
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {!isMe && member.role !== 'owner' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(member.id)}
                          className="text-[#A1A1AA] hover:text-[#F87171] hover:bg-red-500/8 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Roles Reference */}
        <div className="p-8 bg-[#18181B] border border-[#27272A] rounded-xl">
          <h3 className="text-[18px] font-[family-name:var(--font-space-grotesk)] font-extrabold mb-6 flex items-center gap-2 text-[#FAFAFA]">
            <Shield className="w-5 h-5 text-[#8B5CF6]" /> Role Permissions
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#27272A]">
                  <th className="text-left py-3 text-[#A1A1AA] font-semibold">Permission</th>
                  <th className="text-center py-3 font-semibold w-24 text-[#A1A1AA]">Owner</th>
                  <th className="text-center py-3 font-semibold w-24 text-[#A1A1AA]">Admin</th>
                  <th className="text-center py-3 font-semibold w-24 text-[#A1A1AA]">Member</th>
                  <th className="text-center py-3 font-semibold w-24 text-[#A1A1AA]">Viewer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272A] text-center">
                {[
                  { label: "Manage links & rules", roles: [1, 1, 1, 0] },
                  { label: "View analytics", roles: [1, 1, 1, 1] },
                  { label: "Manage custom domains", roles: [1, 1, 0, 0] },
                  { label: "Manage tracking pixels", roles: [1, 1, 0, 0] },
                  { label: "Invite & manage team", roles: [1, 1, 0, 0] },
                  { label: "Billing & workspace delete", roles: [1, 0, 0, 0] },
                ].map((row, i) => (
                  <tr key={i} className="transition-colors hover:bg-[#27272A]/50 border-b border-[#27272A]">
                    <td className="text-left py-3 text-[#E4E4E7] font-medium">{row.label}</td>
                    {row.roles.map((val, j) => (
                      <td key={j} className="py-3">
                        {val ? <CheckCircle2 className="w-4 h-4 text-[#34D399] mx-auto" /> : <span className="text-[#A1A1AA]/30">-</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </ProtectedLayout>
  );
}
