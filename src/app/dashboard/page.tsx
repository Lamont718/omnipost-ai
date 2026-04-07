"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { getSupabase } from "@/lib/supabase";
import { Organization, Post, Platform } from "@/lib/types";
import { getOrgStyle } from "@/lib/org-colors";

interface Metrics {
  scheduled: number;
  pendingApproval: number;
  published: number;
  drafts: number;
}

export default function DashboardPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [pendingPosts, setPendingPosts] = useState<Post[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    scheduled: 0,
    pendingApproval: 0,
    published: 0,
    drafts: 0,
  });
  const [generateOrg, setGenerateOrg] = useState("");
  const [generateTopic, setGenerateTopic] = useState("");
  const [generatePlatform, setGeneratePlatform] = useState<Platform>("instagram");
  const [generating, setGenerating] = useState(false);
  const [generatedCaption, setGeneratedCaption] = useState("");

  const loadData = useCallback(async () => {
    const [orgsRes, postsRes] = await Promise.all([
      getSupabase().from("organizations").select("*"),
      getSupabase().from("posts").select("*, organization:organizations(*)"),
    ]);

    if (orgsRes.data) {
      setOrgs(orgsRes.data);
      if (!generateOrg && orgsRes.data.length > 0) {
        setGenerateOrg(orgsRes.data[0].id);
      }
    }

    if (postsRes.data) {
      const posts = postsRes.data as unknown as Post[];
      setPendingPosts(
        posts
          .filter((p) => p.status === "pending_approval")
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 3)
      );
      setMetrics({
        scheduled: posts.filter((p) => p.status === "scheduled").length,
        pendingApproval: posts.filter((p) => p.status === "pending_approval").length,
        published: posts.filter((p) => p.status === "published").length,
        drafts: posts.filter((p) => p.status === "draft").length,
      });
    }
  }, [generateOrg]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!generateOrg || !generateTopic.trim()) return;
    setGenerating(true);
    setGeneratedCaption("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          org_id: generateOrg,
          topic: generateTopic,
          platform: generatePlatform,
        }),
      });
      const data = await res.json();
      if (data.caption) {
        setGeneratedCaption(data.caption);
        setGenerateTopic("");
        loadData();
      }
    } catch {
      // error handling
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove(postId: string) {
    await getSupabase().from("posts").update({ status: "approved" }).eq("id", postId);
    loadData();
  }

  async function handleReject(postId: string) {
    await getSupabase().from("posts").update({ status: "rejected" }).eq("id", postId);
    loadData();
  }

  return (
    <AppShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Overview of your content pipeline across all organizations
          </p>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Scheduled", value: metrics.scheduled, color: "text-blue-600" },
            { label: "Awaiting Approval", value: metrics.pendingApproval, color: "text-amber-600" },
            { label: "Published", value: metrics.published, color: "text-green-600" },
            { label: "Drafts", value: metrics.drafts, color: "text-gray-600" },
          ].map((m) => (
            <div
              key={m.label}
              className="bg-white rounded-xl border border-gray-100 p-5"
            >
              <p className="text-sm text-gray-500">{m.label}</p>
              <p className={`text-3xl font-bold mt-1 ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Approval Queue Preview */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Pending Approval
              </h2>
              <a
                href="/queue"
                className="text-sm text-brand-500 hover:text-brand-600 font-medium"
              >
                View All
              </a>
            </div>

            {pendingPosts.length === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">
                No posts awaiting approval
              </p>
            ) : (
              <div className="space-y-4">
                {pendingPosts.map((post) => {
                  const org = orgs.find((o) => o.id === post.org_id);
                  const style = org ? getOrgStyle(org.color_hex) : getOrgStyle("");
                  return (
                    <div key={post.id} className="border border-gray-100 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${style.badge}`}
                        >
                          {org?.name || "Unknown"}
                        </span>
                        <span className="text-xs text-gray-400 capitalize">
                          {post.platform}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2 mb-3">
                        {post.caption}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(post.id)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(post.id)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Generate Widget */}
          <div className="bg-white rounded-xl border border-gray-100 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Quick Generate
            </h2>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Organization
                </label>
                <select
                  value={generateOrg}
                  onChange={(e) => setGenerateOrg(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  {orgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Platform
                </label>
                <select
                  value={generatePlatform}
                  onChange={(e) => setGeneratePlatform(e.target.value as Platform)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                >
                  <option value="instagram">Instagram</option>
                  <option value="facebook">Facebook</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="x">X (Twitter)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Topic
                </label>
                <textarea
                  value={generateTopic}
                  onChange={(e) => setGenerateTopic(e.target.value)}
                  rows={3}
                  placeholder="What should this post be about?"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={generating || !generateTopic.trim()}
                className="w-full bg-brand-500 hover:bg-brand-600 text-white font-medium py-2.5 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generating ? "Generating..." : "Generate Post"}
              </button>
            </form>

            {generatedCaption && (
              <div className="mt-4 p-4 bg-brand-50 rounded-lg border border-brand-100">
                <p className="text-xs font-medium text-brand-600 mb-1">
                  Generated Caption (saved as pending)
                </p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {generatedCaption}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
