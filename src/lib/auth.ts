import { getSupabase } from "./supabase";

export async function getSession() {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();
  return session;
}

export async function getUser() {
  const {
    data: { user },
  } = await getSupabase().auth.getUser();
  return user;
}

export async function signOut() {
  await getSupabase().auth.signOut();
}
