"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerUploadedDocument } from "@/app/actions/documents";
import {
  Alert,
  Button,
  FieldHint,
  Input,
  Label,
  Select,
  Spinner,
} from "@/components/ui";

const GROQ_WHISPER_MAX_BYTES = 25 * 1024 * 1024;

const CATEGORY_OPTIONS = [
  { value: "textbook", label: "Textbook" },
  { value: "supplementary_pdf", label: "Supplementary PDF" },
  { value: "lecture_slides", label: "Lecture slides" },
  { value: "past_exam", label: "Past exam" },
  { value: "personal_notes", label: "Personal notes" },
  {
    value: "lecture_audio",
    label: "Lecture audio (will be transcribed then the audio deleted)",
  },
];

export default function UploadFileForm({
  courseId,
  stayOnPage = false,
  compact = false,
  onSuccess,
}: {
  courseId: string;
  /** Skip the navigate-to-course-page redirect and just refresh in place — for embedding on a page other than the upload page (e.g. the study screen's materials column). */
  stayOnPage?: boolean;
  /** Tighter spacing/sizing to fit a narrow column. */
  compact?: boolean;
  /** Called after a successful upload (e.g. so an embedding parent can collapse itself). */
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [category, setCategory] = useState("textbook");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const looksLikeAudio =
    category === "lecture_audio" ||
    (file ? /\.(mp3|m4a|wav|ogg)$/i.test(file.name) : false);
  const audioTooBigWarning =
    file && looksLikeAudio && file.size > GROQ_WHISPER_MAX_BYTES
      ? "This audio file is over 25 MB — Groq Whisper rejects files above that cap, so transcription will fail. You can still upload it, but consider compressing or splitting it first."
      : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError("Choose a file first.");
      return;
    }
    const finalTitle = (title.trim() || file.name).trim();

    setUploading(true);
    try {
      const documentId = crypto.randomUUID();
      const storagePath = `${courseId}/${documentId}/${file.name}`;

      // Upload straight from the browser so big textbooks don't hit
      // server-action body-size limits. Storage RLS only lets admins insert.
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("course-files")
        .upload(storagePath, file);
      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const result = await registerUploadedDocument({
        documentId,
        courseId,
        title: finalTitle,
        category,
        storagePath,
        sourceFilename: file.name,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }

      if (stayOnPage) {
        router.refresh();
      } else {
        router.push(`/courses/${courseId}`);
        router.refresh();
      }
      onSuccess?.();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={compact ? "space-y-2.5" : "max-w-xl space-y-4"}
    >
      <div>
        <Label htmlFor="upload-file">File</Label>
        <Input
          id="upload-file"
          type="file"
          accept=".pdf,.txt,.mp3,.m4a,.wav,.ogg"
          onChange={(event) => {
            const selected = event.target.files?.[0] ?? null;
            setFile(selected);
            if (selected && !titleEdited) setTitle(selected.name);
          }}
          className="cursor-pointer text-sm text-slate-500 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-800 hover:file:bg-brand-200"
        />
        {!compact && (
          <FieldHint>PDF, plain text, or audio (.mp3, .m4a, .wav, .ogg).</FieldHint>
        )}
      </div>
      <div>
        <Label htmlFor="upload-title">Title</Label>
        <Input
          id="upload-title"
          type="text"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setTitleEdited(true);
          }}
          placeholder="Defaults to the file name"
        />
      </div>
      <div>
        <Label htmlFor="upload-category">Category</Label>
        <Select
          id="upload-category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
      {audioTooBigWarning && <Alert tone="info">{audioTooBigWarning}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      <Button type="submit" size={compact ? "sm" : "md"} disabled={uploading || !file}>
        {uploading && <Spinner className="border-white/40 border-t-white" />}
        {uploading ? "Uploading…" : "Upload"}
      </Button>
    </form>
  );
}
