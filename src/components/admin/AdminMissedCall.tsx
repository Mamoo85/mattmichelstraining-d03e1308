import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, MessageSquare, Clock, Users, PhoneIncoming } from "lucide-react";

interface MissedCallClient {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  business_phone: string | null;
  twilio_number: string | null;
  response_message: string | null;
  call_count: number;
  text_count: number;
  active: boolean;
  created_at: string;
}

interface MissedCallCapture {
  id: string;
  caller_number: string;
  city: string | null;
  replied: boolean;
  created_at: string;
  client_id: string;
  missed_call_clients?: { business_name: string } | null;
}

interface CallbackReminder {
  id: string;
  caller_number: string;
  callback_number: string;
  sent_to_matt: boolean;
  created_at: string;
  client_id: string;
  missed_call_clients?: { business_name: string } | null;
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <Card className="bg-[#0f1e35] border-white/10">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon size={16} className="text-white" />
          </div>
          <div>
            <div className="text-xl font-bold text-white">{value}</div>
            <div className="text-xs text-white/50">{label}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminMissedCall() {
  const [clients, setClients] = useState<MissedCallClient[]>([]);
  const [captures, setCaptures] = useState<MissedCallCapture[]>([]);
  const [callbacks, setCallbacks] = useState<CallbackReminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [c, cap, cb] = await Promise.all([
        (supabase as any).from("missed_call_clients").select("*").order("created_at", { ascending: false }),
        (supabase as any).from("missed_call_captures").select("*, missed_call_clients(business_name)").order("created_at", { ascending: false }).limit(20),
        (supabase as any).from("callback_reminders").select("*, missed_call_clients(business_name)").eq("sent_to_matt", false).order("created_at", { ascending: false }).limit(20),
      ]);
      setClients(c.data ?? []);
      setCaptures(cap.data ?? []);
      setCallbacks(cb.data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const activeClients = clients.filter(c => c.active);
  const totalCalls = clients.reduce((s, c) => s + (c.call_count ?? 0), 0);
  const totalTexts = clients.reduce((s, c) => s + (c.text_count ?? 0), 0);

  if (loading) return <div className="text-white/40 text-sm p-6">Loading Missed-Call data…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Missed-Call Catch</h2>
        <p className="text-white/50 text-sm">$99/mo standalone · $49/mo bundled</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Active Clients" value={activeClients.length} color="bg-teal-600" />
        <StatCard icon={PhoneIncoming} label="Calls Captured" value={totalCalls} color="bg-blue-600" />
        <StatCard icon={MessageSquare} label="Texts Sent" value={totalTexts} color="bg-purple-600" />
        <StatCard icon={Clock} label="Pending Callbacks" value={callbacks.length} color="bg-orange-600" />
      </div>

      {/* Active Clients */}
      <Card className="bg-[#0f1e35] border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm font-semibold">Clients ({clients.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/50 text-xs">Business</TableHead>
                <TableHead className="text-white/50 text-xs">Twilio #</TableHead>
                <TableHead className="text-white/50 text-xs text-right">Calls</TableHead>
                <TableHead className="text-white/50 text-xs text-right">Texts</TableHead>
                <TableHead className="text-white/50 text-xs">Status</TableHead>
                <TableHead className="text-white/50 text-xs">Since</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-white/40 text-sm text-center py-6">No clients yet</TableCell></TableRow>
              )}
              {clients.map(c => (
                <TableRow key={c.id} className="border-white/10 hover:bg-white/5">
                  <TableCell className="text-white text-sm font-medium">{c.business_name}</TableCell>
                  <TableCell className="text-white/60 text-xs font-mono">{c.twilio_number ?? "—"}</TableCell>
                  <TableCell className="text-white/80 text-sm text-right">{c.call_count}</TableCell>
                  <TableCell className="text-white/80 text-sm text-right">{c.text_count}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={c.active ? "border-teal-400 text-teal-400" : "border-red-400 text-red-400"}>
                      {c.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-white/40 text-xs">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pending Callbacks */}
      {callbacks.length > 0 && (
        <Card className="bg-[#0f1e35] border-orange-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-orange-400 text-sm font-semibold flex items-center gap-2">
              <Clock size={14} /> Pending Callbacks ({callbacks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-white/50 text-xs">Client</TableHead>
                  <TableHead className="text-white/50 text-xs">Caller</TableHead>
                  <TableHead className="text-white/50 text-xs">Requested #</TableHead>
                  <TableHead className="text-white/50 text-xs">Received</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {callbacks.map(cb => (
                  <TableRow key={cb.id} className="border-white/10 hover:bg-white/5">
                    <TableCell className="text-white/80 text-sm">{cb.missed_call_clients?.business_name ?? "—"}</TableCell>
                    <TableCell className="text-white/60 text-xs font-mono">{cb.caller_number}</TableCell>
                    <TableCell className="text-white/60 text-xs font-mono">{cb.callback_number}</TableCell>
                    <TableCell className="text-white/40 text-xs">{new Date(cb.created_at).toLocaleTimeString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Captures */}
      <Card className="bg-[#0f1e35] border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-sm font-semibold flex items-center gap-2">
            <PhoneIncoming size={14} /> Recent Captures
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-white/50 text-xs">Client</TableHead>
                <TableHead className="text-white/50 text-xs">Caller</TableHead>
                <TableHead className="text-white/50 text-xs">City</TableHead>
                <TableHead className="text-white/50 text-xs">Replied</TableHead>
                <TableHead className="text-white/50 text-xs">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {captures.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-white/40 text-sm text-center py-6">No captures yet</TableCell></TableRow>
              )}
              {captures.map(cap => (
                <TableRow key={cap.id} className="border-white/10 hover:bg-white/5">
                  <TableCell className="text-white/80 text-sm">{cap.missed_call_clients?.business_name ?? "—"}</TableCell>
                  <TableCell className="text-white/60 text-xs font-mono">{cap.caller_number}</TableCell>
                  <TableCell className="text-white/60 text-xs">{cap.city ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cap.replied ? "border-teal-400 text-teal-400" : "border-white/20 text-white/40"}>
                      {cap.replied ? "Yes" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-white/40 text-xs">{new Date(cap.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
