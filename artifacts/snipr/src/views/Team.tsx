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
      <div className="p-8 max-w-5xl mx-auto w-full animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">Team Members</h1>
            <p className="text-muted-foreground mt-1">Manage who has access to this workspace.</p>
          </div>
          <Button onClick={() => setShowInvite(!showInvite)} className="rounded-xl h-11 px-6 shadow-sm">
            <UserPlus className="w-4 h-4 mr-2" /> Invite Member
          </Button>
        </div>

        {showInvite && (
          <div className="mb-8 p-6 bg-card rounded-2xl border border-primary/20 shadow-lg shadow-primary/5 animate-in slide-in-from-top-4 fade-in">
            <h3 className="font-semibold mb-4 flex items-center gap-2 text-primary">
              <Mail className="w-5 h-5" /> Send Invitation
            </h3>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="space-y-2 w-full sm:flex-1">
                <label className="text-sm font-semibold">Email Address</label>
                <Input 
                  type="email" 
                  required 
                  placeholder="colleague@company.com" 
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="bg-background rounded-xl h-11"
                />
              </div>
              <div className="space-y-2 w-full sm:w-48">
                <label className="text-sm font-semibold">Role</label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="bg-background rounded-xl h-11">
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
                <Button type="button" variant="ghost" onClick={() => setShowInvite(false)} className="rounded-xl h-11 w-full sm:w-auto">Cancel</Button>
                <Button type="submit" disabled={inviteMutation.isPending} className="rounded-xl h-11 w-full sm:w-auto">
                  {inviteMutation.isPending ? "Sending..." : "Send Invite"}
                </Button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm mb-12">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground font-semibold border-b border-border">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">Loading members...</td></tr>
              ) : members?.map(member => {
                const isMe = member.userId === currentUser?.id;
                return (
                  <tr key={member.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        {member.name || "Pending User"}
                        {isMe && <Badge variant="secondary" className="text-xs font-normal">You</Badge>}
                      </div>
                      <div className="text-muted-foreground">{member.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      {member.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-700">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : member.status === 'invited' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-700">
                          <Mail className="w-3.5 h-3.5" /> Invited
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#E5E7EB] text-[#C3C3C1]">
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
                        <SelectTrigger className="w-32 h-9 rounded-lg bg-transparent border-transparent hover:border-border focus:border-primary transition-all">
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
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
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
        <div className="bg-card rounded-2xl border border-border p-8 shadow-sm">
          <h3 className="text-lg font-display font-bold mb-6 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" /> Role Permissions
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 text-muted-foreground font-semibold">Permission</th>
                  <th className="text-center py-3 font-semibold w-24">Owner</th>
                  <th className="text-center py-3 font-semibold w-24">Admin</th>
                  <th className="text-center py-3 font-semibold w-24">Member</th>
                  <th className="text-center py-3 font-semibold w-24">Viewer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-center">
                {[
                  { label: "Manage links & rules", roles: [1, 1, 1, 0] },
                  { label: "View analytics", roles: [1, 1, 1, 1] },
                  { label: "Manage custom domains", roles: [1, 1, 0, 0] },
                  { label: "Manage tracking pixels", roles: [1, 1, 0, 0] },
                  { label: "Invite & manage team", roles: [1, 1, 0, 0] },
                  { label: "Billing & workspace delete", roles: [1, 0, 0, 0] },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="text-left py-3 text-foreground font-medium">{row.label}</td>
                    {row.roles.map((val, j) => (
                      <td key={j} className="py-3">
                        {val ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <span className="text-muted-foreground/30">-</span>}
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
