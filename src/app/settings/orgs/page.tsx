"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { getSupabase } from "@/lib/supabase";
import { Organization, VoiceProfile } from "@/lib/types";
import { getOrgStyle } from "@/lib/org-colors";

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [saving, setSaving] = useState(false);
  const [editVoice, setEditVoice] = useState<VoiceProfile | null>(null);

  const loadOrgs = useCallback(async () => {
    const { data } = await getSupabase()
      .from("organizations")
      .select("*")
      .order("name");
    if (data) setOrgs(data);
  }, []);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  function startEdit(org: Organization) {
    setEditingOrg(org);
    setEditVoice({ ...org.voice_profile });
  }

  async function saveVoiceProfile() {
    if (!editingOrg || !editVoice) return;
    setSaving(true);

    await getSupabase()
      .from("organizations")
      .update({ voice_profile: editVoice as unknown as Record<string, unknown> })
      .eq("id", editingOrg.id);

    setSaving(false);
    setEditingOrg(null);
    setEditVoice(null);
    loadOrgs();
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage brand voices and organization settings
          </p>
        </div>

        {/* Org editing modal */}
        {editingOrg && editVoice && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">
                  Edit Voice Profile — {editingOrg.name}
                </h2>
                <button
                  onClick={() => {
                    setEditingOrg(null);
                    setEditVoice(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Tone
                  </label>
                  <input
                    value={editVoice.tone}
                    onChange={(e) =>
                      setEditVoice({ ...editVoice, tone: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Target Audience
                  </label>
                  <input
                    value={editVoice.audience}
                    onChange={(e) =>
                      setEditVoice({ ...editVoice, audience: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Cultural Context
                  </label>
                  <textarea
                    value={editVoice.cultural_context}
                    onChange={(e) =>
                      setEditVoice({
                        ...editVoice,
                        cultural_context: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Emoji Style
                  </label>
                  <select
                    value={editVoice.emoji_style}
                    onChange={(e) =>
                      setEditVoice({
                        ...editVoice,
                        emoji_style: e.target.value as "minimal" | "moderate" | "none",
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  >
                    <option value="none">None</option>
                    <option value="minimal">Minimal</option>
                    <option value="moderate">Moderate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Hashtags (comma-separated)
                  </label>
                  <input
                    value={editVoice.hashtags.join(", ")}
                    onChange={(e) =>
                      setEditVoice({
                        ...editVoice,
                        hashtags: e.target.value
                          .split(",")
                          .map((h) => h.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Banned Words (comma-separated)
                  </label>
                  <input
                    value={editVoice.banned_words.join(", ")}
                    onChange={(e) =>
                      setEditVoice({
                        ...editVoice,
                        banned_words: e.target.value
                          .split(",")
                          .map((w) => w.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Keywords (comma-separated)
                  </label>
                  <input
                    value={(editVoice.keywords || []).join(", ")}
                    onChange={(e) =>
                      setEditVoice({
                        ...editVoice,
                        keywords: e.target.value
                          .split(",")
                          .map((k) => k.trim())
                          .filter(Boolean),
                      })
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
                <button
                  onClick={saveVoiceProfile}
                  disabled={saving}
                  className="bg-brand-500 hover:bg-brand-600 text-white font-medium py-2.5 px-6 rounded-lg text-sm transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={() => {
                    setEditingOrg(null);
                    setEditVoice(null);
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-6 rounded-lg text-sm transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Org Cards */}
        <div className="grid gap-4">
          {orgs.map((org) => {
            const style = getOrgStyle(org.color_hex);
            const voice = org.voice_profile;
            return (
              <div
                key={org.id}
                className="bg-white rounded-xl border border-gray-100 p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm ${style.dot.replace("bg-", "bg-")}`}
                      style={{ backgroundColor: org.color_hex }}
                    >
                      {org.name.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {org.name}
                      </h3>
                      <p className="text-xs text-gray-400">/{org.slug}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => startEdit(org)}
                    className="text-sm font-medium text-brand-500 hover:text-brand-600 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition"
                  >
                    Edit Voice
                  </button>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                      Tone
                    </p>
                    <p className="text-sm text-gray-700">{voice.tone}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                      Audience
                    </p>
                    <p className="text-sm text-gray-700">{voice.audience}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">
                      Emoji Style
                    </p>
                    <p className="text-sm text-gray-700 capitalize">
                      {voice.emoji_style}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {voice.hashtags.map((tag: string) => (
                    <span
                      key={tag}
                      className={`text-xs px-2 py-0.5 rounded-full ${style.badge}`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
