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
            <div className="w-11 h-11 rounded-[14px] flex items-center justify-center" style={{ background: "linear-gradient(135deg, #818CF8, #A78BFA)" }}>
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-[28px] font-[family-name:var(--font-space-grotesk)] font-extrabold tracking-[-0.02em] text-[#F1F5F9]">Team Members</h1>
              <p className="text-[13px] text-[#94A3B8] mt-1">Manage who has access to this workspace.</p>
            </div>
          </div>
          <button onClick={() => setShowInvite(!showInvite)} className="rounded-[14px] h-11 px-6 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90" style={{ background: "linear-gradient(135deg, #818CF8, #A78BFA)", boxShadow: "0 4px 14px rgba(129,140,248,0.25)" }}>
            <UserPlus className="w-4 h-4" /> Invite Member
          </button>
        </div>

        {showInvite && (
          <div className="mb-8 p-6 animate-in slide-in-from-top-4 fade-in" style={{
            background: "rgba(17,24,39,0.65)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            border: "1px solid rgba(129,140,248,0.15)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 8px 32px rgba(129,140,248,0.08)",
            borderRadius: "20px",
          }}>
            <h3 className="font-semibold mb-4 flex items-center gap-2 text-[#818CF8]">
              <Mail className="w-5 h-5" /> Send Invitation
            </h3>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="space-y-2 w-full sm:flex-1">
                <label className="text-[12px] font-semibold text-[#64748B]">Email Address</label>
                <Input
                  type="email"
                  required
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="rounded-xl h-11"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#E2E8F0" }}
                />
              </div>
              <div className="space-y-2 w-full sm:w-48">
                <label className="text-[12px] font-semibold text-[#64748B]">Role</label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="rounded-xl h-11" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#E2E8F0" }}>
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
                <Button type="button" variant="ghost" onClick={() => setShowInvite(false)} className="rounded-xl h-11 w-full sm:w-auto text-[#94A3B8]">Cancel</Button>
                <button type="submit" disabled={inviteMutation.isPending} className="rounded-[14px] h-11 px-6 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 w-full sm:w-auto disabled:opacity-50" style={{ background: "linear-gradient(135deg, #818CF8, #A78BFA)", boxShadow: "0 4px 14px rgba(129,140,248,0.25)" }}>
                  {inviteMutation.isPending ? "Sending..." : "Send Invite"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="overflow-hidden mb-12" style={{
          background: "rgba(17,24,39,0.65)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.3)",
          borderRadius: "20px",
        }}>
          <table className="w-full text-sm text-left">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <th className="px-6 py-4 text-[#94A3B8] font-semibold">User</th>
                <th className="px-6 py-4 text-[#94A3B8] font-semibold">Status</th>
                <th className="px-6 py-4 text-[#94A3B8] font-semibold">Role</th>
                <th className="px-6 py-4 text-right text-[#94A3B8] font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              {isLoading ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-[#94A3B8]">Loading members...</td></tr>
              ) : members?.map(member => {
                const isMe = member.userId === currentUser?.id;
                return (
                  <tr key={member.id} className="transition-colors group" style={{ borderBottomColor: "rgba(255,255,255,0.06)" }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-[#F1F5F9] flex items-center gap-2">
                        {member.name || "Pending User"}
                        {isMe && <Badge variant="secondary" className="text-xs font-normal">You</Badge>}
                      </div>
                      <div className="text-[#94A3B8]">{member.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      {member.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-[#34D399]" style={{ background: "rgba(52,211,153,0.1)" }}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : member.status === 'invited' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-[#FB923C]" style={{ background: "rgba(251,146,60,0.1)" }}>
                          <Mail className="w-3.5 h-3.5" /> Invited
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-[#94A3B8]" style={{ background: "rgba(255,255,255,0.06)" }}>
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
                        <SelectTrigger className="w-32 h-9 rounded-lg bg-transparent border-transparent hover:border-[rgba(129,140,248,0.3)] focus:border-[#818CF8] transition-all" style={{ color: "#E2E8F0" }}>
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
                          className="text-[#94A3B8] hover:text-[#F87171] hover:bg-[rgba(248,113,113,0.08)] rounded-lg opacity-0 group-hover:opacity-100 transition-all"
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
        <div className="p-8" style={{
          background: "rgba(17,24,39,0.65)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.3)",
          borderRadius: "20px",
        }}>
          <h3 className="text-[18px] font-[family-name:var(--font-space-grotesk)] font-extrabold mb-6 flex items-center gap-2 text-[#F1F5F9]">
            <Shield className="w-5 h-5 text-[#818CF8]" /> Role Permissions
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <th className="text-left py-3 text-[#94A3B8] font-semibold">Permission</th>
                  <th className="text-center py-3 font-semibold w-24 text-[#94A3B8]">Owner</th>
                  <th className="text-center py-3 font-semibold w-24 text-[#94A3B8]">Admin</th>
                  <th className="text-center py-3 font-semibold w-24 text-[#94A3B8]">Member</th>
                  <th className="text-center py-3 font-semibold w-24 text-[#94A3B8]">Viewer</th>
                </tr>
              </thead>
              <tbody className="divide-y text-center" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                {[
                  { label: "Manage links & rules", roles: [1, 1, 1, 0] },
                  { label: "View analytics", roles: [1, 1, 1, 1] },
                  { label: "Manage custom domains", roles: [1, 1, 0, 0] },
                  { label: "Manage tracking pixels", roles: [1, 1, 0, 0] },
                  { label: "Invite & manage team", roles: [1, 1, 0, 0] },
                  { label: "Billing & workspace delete", roles: [1, 0, 0, 0] },
                ].map((row, i) => (
                  <tr key={i} className="transition-colors" style={{ borderBottomColor: "rgba(255,255,255,0.06)" }} onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                    <td className="text-left py-3 text-[#E2E8F0] font-medium">{row.label}</td>
                    {row.roles.map((val, j) => (
                      <td key={j} className="py-3">
                        {val ? <CheckCircle2 className="w-4 h-4 text-[#34D399] mx-auto" /> : <span className="text-[#94A3B8]/30">-</span>}
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
