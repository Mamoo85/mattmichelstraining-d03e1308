import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Returns the current user's ID plus all linked family member IDs
 * (parent's children if user is parent, or parent if user is child).
 * Useful for fetching shared content libraries.
 */
export const useFamilyUserIds = () => {
  const { user } = useAuth();
  const [familyIds, setFamilyIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setFamilyIds([]);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const ids = new Set<string>([user.id]);

      // Check if user is a parent (has children)
      const { data: children } = await supabase
        .from("parent_child_links")
        .select("child_user_id")
        .eq("parent_user_id", user.id);

      if (children) {
        for (const c of children) ids.add(c.child_user_id);
      }

      // Check if user is a child (has parent)
      const { data: parent } = await supabase
        .from("parent_child_links")
        .select("parent_user_id")
        .eq("child_user_id", user.id)
        .maybeSingle();

      if (parent) {
        ids.add(parent.parent_user_id);
        // Also get siblings
        const { data: siblings } = await supabase
          .from("parent_child_links")
          .select("child_user_id")
          .eq("parent_user_id", parent.parent_user_id);
        if (siblings) {
          for (const s of siblings) ids.add(s.child_user_id);
        }
      }

      setFamilyIds(Array.from(ids));
      setLoading(false);
    };

    fetch();
  }, [user]);

  return { familyIds, loading };
};
