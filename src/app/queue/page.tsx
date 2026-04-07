"use client";

import { useEffect, useState, useCallback } from "react";
import AppShell from "@/components/AppShell";
import { getSupabase } from "@/lib/supabase";
import { Organization, Post } from "@/lib/types";
import { getOrgStyle } from "@/lib/org-colors";

export default function QueuePage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    const [orgsRes, postsRes] = await Promise.all([
      getSupabase().from("organizations").select("*"),
      getSupabase()
        .from("posts")
        .select("*")
        .eq("status", "pending_approval")
        .order("created_at", { ascending: false }),
    ]);

    if (orgsRes.data) setOrgs(orgsRes.data);
    if (postsRes.data) setPosts(postsRes.data as Post[]);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function getOrg(orgId: string) {
    return orgs.find((o) => o.id === orgId);
  }

  async function handleApprove(postId: string) {
    await getSupabase().from("posts").update({ status: "approved" }).eq("id", postId);
    loadData();
  }

  async function handleReject(postId: string) {
    await getSupabase().from("posts").update({ status: "rejected" }).eq("id", postId);
    loadData();
  }

  function startEdit(post: Post) {
    setEditingId(post.id);
    setEditCaption(post.caption);
  }

  async function saveEdit(postId: string) {
    await getSupabase()
      .from("posts")
      .update({ caption: editCaption })
      .eq("id", postId);
    setEditingId(null);
    loadData();
  }

  function toggleSelect(postId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else next.add(postId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === posts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(posts.map((p) => p.id)));
    }
  }

  async function bulkApprove() {
    const ids = Array.from(selectedIds);
    await getSupabase()
      .from("posts")
      .update({ status: "approved" })
      .in("id", ids);
    setSelectedIds(new Set());
    loadData();
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Approval Queue</h1>
            <p className="text-sm text-gray-500 mt-1">
              {posts.length} post{posts.length !== 1 ? "s" : ""} awaiting review
            </p>
          </div>

          {selectedIds.size > 0 && (
            <button
              onClick={bulkApprove}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              Approve Selected ({selectedIds.size})
            </button>
          )}
        </div>

        {posts.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <svg
              className="w-12 h-12 mx-auto text-gray-300 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <p className="text-gray-500 text-sm">All clear! No posts need approval.</p>
          </div>
        ) : (
          <>
            {/* Select All */}
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                className="text-sm text-gray-500 hover:text-gray-700 font-medium"
              >
                {selectedIds.size === posts.length
                  ? "Deselect All"
                  : "Select All"}
              </button>
            </div>

            <div className="space-y-4">
              {posts.map((post) => {
                const org = getOrg(post.org_id);
                const style = org
                  ? getOrgStyle(org.color_hex)
                  : getOrgStyle("");
                const isEditing = editingId === post.id;

                return (
                  <div
                    key={post.id}
                    className="bg-white rounded-xl border border-gray-100 p-5"
                  >
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <div className="pt-1">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(post.id)}
                          onChange={() => toggleSelect(post.id)}
                          className="w-4 h-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-3">
                          <span
                            className={`text-xs font-medium px-2.5 py-1 rounded-full ${style.badge}`}
                          >
                            {org?.name || "Unknown"}
                          </span>
                          <span className="text-xs text-gray-400 capitalize flex items-center gap-1">
                            {post.platform === "instagram" && (
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
                              </svg>
                            )}
                            {post.platform}
                          </span>
                          {post.ai_generated && (
                            <span className="text-xs text-brand-500 font-medium">
                              AI Generated
                            </span>
                          )}
                          <span className="text-xs text-gray-300 ml-auto">
                            {new Date(post.created_at).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
                            )}
                          </span>
                        </div>

                        {/* Caption */}
                        {isEditing ? (
                          <div className="mb-3">
                            <textarea
                              value={editCaption}
                              onChange={(e) => setEditCaption(e.target.value)}
                              rows={4}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none"
                            />
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => saveEdit(post.id)}
                                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700 whitespace-pre-wrap mb-4">
                            {post.caption}
                          </p>
                        )}

                        {/* Actions */}
                        {!isEditing && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleApprove(post.id)}
                              className="text-xs font-medium px-4 py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(post.id)}
                              className="text-xs font-medium px-4 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => startEdit(post)}
                              className="text-xs font-medium px-4 py-2 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 transition"
                            >
                              Edit
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
