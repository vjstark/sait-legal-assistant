"use client";

import { useState, useSyncExternalStore } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  Label,
  PageHeader,
  cn,
} from "@/components/ui";

// Which chat provider is active — persisted separately from the keys
// themselves, since a provider needs only its own key to work.
const PROVIDER_STORAGE_KEY = "tutor:chat-provider";

// Keys live ONLY in this browser's localStorage — never in the database.
const KEY_DEFS = [
  {
    storageKey: "tutor:anthropic-key",
    label: "Anthropic API key",
    hint: "Used when Claude (Anthropic) is the selected chat provider, for the tutor, quizzes, and flashcards.",
    getUrl: "https://console.anthropic.com",
    getLabel: "console.anthropic.com",
  },
  {
    storageKey: "tutor:gemini-key",
    label: "Google Gemini API key",
    hint: "Used when Google Gemini is the selected chat provider, for the tutor, quizzes, and flashcards.",
    getUrl: "https://aistudio.google.com/apikey",
    getLabel: "aistudio.google.com",
  },
  {
    storageKey: "tutor:voyage-key",
    label: "Voyage API key (optional)",
    hint: "Powers search over course materials. Leave empty to use the admin-funded shared key.",
    getUrl: "https://www.voyageai.com",
    getLabel: "voyageai.com",
  },
  {
    storageKey: "tutor:groq-key",
    label: "Groq API key (admins only, for lecture-audio transcription)",
    hint: "Only needed if you upload lecture audio.",
    getUrl: "https://console.groq.com",
    getLabel: "console.groq.com",
  },
] as const;

const PROVIDER_OPTIONS = [
  {
    value: "anthropic",
    title: "Claude (Anthropic)",
    detail: "Best quality — pay-per-use API key.",
  },
  {
    value: "gemini",
    title: "Google Gemini",
    detail: "Free API key from Google AI Studio, no card required.",
  },
] as const;

function maskKey(value: string): string {
  return `…${value.slice(-4)}`;
}

// Read current key values straight from localStorage on each render
// (serialized so useSyncExternalStore can compare snapshots by value).
// SSR renders "nothing set"; the client snapshot takes over after hydration.
const subscribeNoop = () => () => {};
const getSnapshot = () =>
  JSON.stringify({
    ...Object.fromEntries(
      KEY_DEFS.map((def) => [def.storageKey, localStorage.getItem(def.storageKey) ?? ""]),
    ),
    [PROVIDER_STORAGE_KEY]: localStorage.getItem(PROVIDER_STORAGE_KEY) ?? "",
  });
const getServerSnapshot = () => "{}";

function ProviderOption({
  value,
  title,
  detail,
  selected,
  onSelect,
}: {
  value: string;
  title: string;
  detail: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-3.5 transition-colors",
        "hover:border-brand-200 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50",
      )}
    >
      <input
        type="radio"
        name="chat-provider"
        value={value}
        checked={selected}
        onChange={onSelect}
        className="mt-0.5 accent-brand-700"
      />
      <span className="text-sm">
        <span className="block font-medium text-brand-900">{title}</span>
        <span className="mt-0.5 block text-slate-500">{detail}</span>
      </span>
    </label>
  );
}

export default function ApiKeysPage() {
  const saved = JSON.parse(
    useSyncExternalStore(subscribeNoop, getSnapshot, getServerSnapshot),
  ) as Record<string, string>;
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);

  const currentProvider = saved[PROVIDER_STORAGE_KEY] === "gemini" ? "gemini" : "anthropic";
  const [providerDraft, setProviderDraft] = useState<string | null>(null);
  const selectedProvider = providerDraft ?? currentProvider;

  const selectProvider = (value: string) => {
    setProviderDraft(value);
    localStorage.setItem(PROVIDER_STORAGE_KEY, value);
    setStatus(
      `Chat provider set to ${PROVIDER_OPTIONS.find((o) => o.value === value)?.title ?? value}.`,
    );
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    for (const def of KEY_DEFS) {
      const entered = (inputs[def.storageKey] ?? "").trim();
      if (entered) {
        localStorage.setItem(def.storageKey, entered);
      }
    }
    setInputs({});
    setStatus("Saved. Keys are stored in this browser only.");
  };

  const clear = (storageKey: string, label: string) => {
    localStorage.removeItem(storageKey);
    setStatus(`${label} cleared.`);
  };

  return (
    <>
      <PageHeader
        title="API keys"
        description={
          <>
            <strong className="font-semibold text-brand-900">
              Your chat keys never leave your control.
            </strong>{" "}
            They are stored only in this browser (localStorage), are sent only
            along with your own requests to power them, and are never stored or
            logged on the server. The Voyage embedding key is optional — an
            admin-funded key is used automatically if you don't add your own.
            Clearing your browser data removes your keys; other devices and
            browsers need them entered again.
          </>
        }
      />

      <div className="max-w-2xl space-y-6">
        {status && <Alert tone="success">{status}</Alert>}

        <Card>
          <CardBody>
            <h2 className="text-lg font-semibold">Chat provider</h2>
            <p className="mt-1 text-sm text-slate-500">
              Which AI powers the tutor, quizzes, and flashcards. Only the matching key below is
              used.
            </p>
            <div className="mt-3 space-y-2.5">
              {PROVIDER_OPTIONS.map((option) => (
                <ProviderOption
                  key={option.value}
                  value={option.value}
                  title={option.title}
                  detail={option.detail}
                  selected={selectedProvider === option.value}
                  onSelect={() => selectProvider(option.value)}
                />
              ))}
            </div>
          </CardBody>
        </Card>

        {KEY_DEFS.map((def) => {
          const current = saved[def.storageKey] ?? "";
          return (
            <Card key={def.storageKey}>
              <CardBody>
                <form onSubmit={save} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                    <h2 className="text-lg font-semibold">{def.label}</h2>
                    {current ? (
                      <Badge tone="success">ends in {maskKey(current)}</Badge>
                    ) : (
                      <Badge tone="neutral">not set</Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">
                    {def.hint} Get one at{" "}
                    <a
                      href={def.getUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
                    >
                      {def.getLabel}
                    </a>
                    .
                  </p>
                  <div>
                    <Label htmlFor={def.storageKey}>Key</Label>
                    <Input
                      id={def.storageKey}
                      type="password"
                      autoComplete="off"
                      value={inputs[def.storageKey] ?? ""}
                      onChange={(event) =>
                        setInputs({ ...inputs, [def.storageKey]: event.target.value })
                      }
                      placeholder={
                        current ? "Enter a new key to replace it" : "Paste your key"
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button type="submit" size="sm">
                      Save
                    </Button>
                    {current && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => clear(def.storageKey, def.label)}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </form>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </>
  );
}
