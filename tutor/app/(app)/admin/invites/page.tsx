import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { inviteClassmate } from "@/app/actions/invite";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Select,
} from "@/components/ui";

function inviteStatusTone(status: string) {
  if (status === "accepted") return "success" as const;
  if (status === "pending") return "warning" as const;
  return "neutral" as const;
}

function inviteRoleTone(role: string) {
  if (role === "admin") return "accent" as const;
  if (role === "contributor") return "brand" as const;
  return "neutral" as const;
}

export default async function InvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error: errorMessage, success } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/courses");

  const { data: invites } = await supabase
    .from("invites")
    .select("id, email, role, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        title="Invite classmates"
        description="Only invited emails can sign in. Invites arrive as a magic-link email."
      />

      <div className="space-y-8">
        <div className="space-y-4">
          {errorMessage && <Alert tone="error">{errorMessage}</Alert>}
          {success && <Alert tone="success">Invite sent.</Alert>}

          <Card>
            <CardBody>
              <form
                action={inviteClassmate}
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
              >
                <div className="flex-1">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    name="email"
                    placeholder="classmate@example.com"
                    required
                  />
                </div>
                <div className="sm:w-40">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select id="invite-role" name="role" defaultValue="student">
                    <option value="student">Student</option>
                    <option value="contributor">Contributor (uploads need approval)</option>
                    <option value="admin">Admin</option>
                  </Select>
                </div>
                <Button type="submit" className="sm:shrink-0">
                  Send invite
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Sent invites</h2>
          {invites?.length ? (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-3 font-medium">Email</th>
                      <th className="px-5 py-3 font-medium">Role</th>
                      <th className="px-5 py-3 font-medium">Status</th>
                      <th className="px-5 py-3 font-medium">Sent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {invites.map((invite) => (
                      <tr key={invite.id}>
                        <td className="px-5 py-3 font-medium text-slate-800">
                          {invite.email}
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={inviteRoleTone(invite.role)}>{invite.role}</Badge>
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={inviteStatusTone(invite.status)}>
                            {invite.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-slate-500">
                          {new Date(invite.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <EmptyState
              title="No invites sent yet"
              description="Invite your first classmate with the form above."
            />
          )}
        </section>
      </div>
    </>
  );
}
