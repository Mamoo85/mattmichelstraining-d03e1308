import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Users, FileText } from "lucide-react";

const AdminSendHistory = () => {
  const { data: sends = [], isLoading } = useQuery({
    queryKey: ["admin-send-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletter_sends")
        .select("*")
        .order("sent_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground p-4">Loading...</p>;

  if (sends.length === 0) {
    return (
      <div className="bg-card shadow-m2 p-8 text-center">
        <Clock size={24} className="text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-foreground font-bold">No newsletters sent yet</p>
        <p className="text-xs text-muted-foreground mt-1">Compose your first newsletter to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sends.map((send) => (
        <div key={send.id} className="bg-card shadow-m2 p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-foreground truncate">{send.subject}</h3>
              {send.template_name && (
                <div className="flex items-center gap-1 mt-1">
                  <FileText size={10} className="text-primary" />
                  <span className="text-[10px] text-primary">{send.template_name}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1 text-muted-foreground ml-2">
              <Users size={12} />
              <span className="text-xs font-mono">{send.recipient_count}</span>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">{send.body}</p>
          <p className="text-[10px] text-muted-foreground">
            {new Date(send.sent_at).toLocaleDateString()} at {new Date(send.sent_at).toLocaleTimeString()}
          </p>
        </div>
      ))}
    </div>
  );
};

export default AdminSendHistory;
