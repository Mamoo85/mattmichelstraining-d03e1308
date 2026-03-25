import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Shield } from "lucide-react";
import { format } from "date-fns";

const AdminVipAccess = () => {
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin-vip-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, email, is_in_person, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = profiles.filter((p) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (p.full_name ?? "").toLowerCase().includes(q) ||
      (p.email ?? "").toLowerCase().includes(q)
    );
  });

  const handleToggle = async (userId: string, currentValue: boolean) => {
    const newValue = !currentValue;
    setTogglingId(userId);
    try {
      const updatePayload: Record<string, any> = { is_in_person: newValue };
      // When revoking VIP, reset to free tier so they lose paid tool access
      if (!newValue) {
        updatePayload.subscription_tier = "free";
        updatePayload.is_pro = false;
      }
      const { error } = await supabase
        .from("profiles")
        .update(updatePayload as any)
        .eq("user_id", userId);
      if (error) throw error;
      toast({
        title: newValue ? "VIP Access Granted" : "VIP Access Revoked",
        description: newValue
          ? "User now has full in-person access."
          : "User reverted to free tier. Paid tool access removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-vip-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-clients"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setTogglingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
          <Shield size={16} /> In-Person Client Access
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <div className="border rounded-md overflow-auto max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] uppercase">Name</TableHead>
                <TableHead className="text-[10px] uppercase">Email</TableHead>
                <TableHead className="text-[10px] uppercase">Joined</TableHead>
                <TableHead className="text-[10px] uppercase text-right">VIP Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground text-xs py-8">
                    No users found
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((p) => (
                <TableRow key={p.user_id}>
                  <TableCell className="text-xs font-medium">{p.full_name || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.email}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {p.created_at ? format(new Date(p.created_at), "MMM d, yyyy") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {p.is_in_person && (
                        <Badge variant="default" className="text-[8px] px-1.5 py-0">VIP</Badge>
                      )}
                      {togglingId === p.user_id ? (
                        <Loader2 size={16} className="animate-spin text-primary" />
                      ) : (
                        <Switch
                          checked={!!p.is_in_person}
                          onCheckedChange={() => handleToggle(p.user_id, !!p.is_in_person)}
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <p className="text-[10px] text-muted-foreground">
          {profiles.filter((p) => p.is_in_person).length} active VIP client{profiles.filter((p) => p.is_in_person).length !== 1 ? "s" : ""}
        </p>
      </CardContent>
    </Card>
  );
};

export default AdminVipAccess;
