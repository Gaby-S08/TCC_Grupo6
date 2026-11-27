import { supabase } from "@/integrations/supabase/client";

const BUCKET = "help-attachments";

export async function uploadHelpAttachment(
  authUserId: string,
  folder: "tickets" | "avatars" | "chat",
  file: File,
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const path = `${authUserId}/${folder}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    throw new Error(`Falha ao enviar arquivo: ${error.message}`);
  }
  return path;
}

export async function createSignedAttachmentUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}