"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, CardBody, Label, Textarea, cn } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import type { ModePersonalityKey } from "@/lib/ai/prompts";

export type PromptModeData = {
  key: ModePersonalityKey;
  name: string;
  description: string;
  isCustomized: boolean;
  currentText: string;
};

type ServerAction = (formData: FormData) => void | Promise<void>;

/**
 * Master-detail editor for the four tutor mode personalities: a mode list
 * (sidebar at lg+, horizontal tabs below it) on the left, and the selected
 * mode's full prompt editor filling the rest of the width.
 *
 * The prompt itself defaults to a Notion-like read view (rendered markdown
 * in a document-styled Card) with an explicit "Edit" toggle into the raw
 * textarea — reading a long personality prompt is far more common than
 * editing one, so that's the state that should look good by default.
 */
export function PromptEditor({
  modes,
  saveAction,
  resetAction,
  errorMessage,
  saved,
}: {
  modes: PromptModeData[];
  saveAction: ServerAction;
  resetAction: ServerAction;
  errorMessage?: string;
  saved?: boolean;
}) {
  const [selectedKey, setSelectedKey] = useState<ModePersonalityKey>(modes[0]?.key);
  const [value, setValue] = useState(modes[0]?.currentText ?? "");
  const [editing, setEditing] = useState(false);

  const selected = modes.find((mode) => mode.key === selectedKey) ?? modes[0];
  const dirty = value !== selected.currentText;

  function selectMode(mode: PromptModeData) {
    if (mode.key === selectedKey) return;
    if (dirty && !window.confirm("You have unsaved edits to this prompt. Discard them?")) {
      return;
    }
    setSelectedKey(mode.key);
    setValue(mode.currentText);
    setEditing(false);
  }

  function cancelEdit() {
    if (dirty && !window.confirm("You have unsaved edits to this prompt. Discard them?")) {
      return;
    }
    setValue(selected.currentText);
    setEditing(false);
  }

  return (
    <div className="lg:flex lg:items-start lg:gap-6">
      <div
        role="radiogroup"
        aria-label="Tutor mode"
        className={cn(
          "mb-4 flex gap-2 overflow-x-auto pb-1",
          "lg:mb-0 lg:w-64 lg:shrink-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:border-r lg:border-line lg:pr-4 lg:pb-0",
          "xl:sticky xl:top-8",
        )}
      >
        {modes.map((mode) => {
          const isSelected = mode.key === selected.key;
          return (
            <button
              key={mode.key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => selectMode(mode)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-2 text-left text-sm transition-colors lg:w-full",
                isSelected ? "bg-brand-100 text-brand-900" : "text-slate-600 hover:bg-brand-50",
              )}
            >
              <span className="flex items-center gap-2 whitespace-nowrap lg:whitespace-normal">
                <span className="font-medium">{mode.name}</span>
                {mode.isCustomized && <Badge tone="brand">Customized</Badge>}
              </span>
              <span className="hidden text-xs text-slate-500 lg:block">{mode.description}</span>
            </button>
          );
        })}
      </div>

      <div className="min-w-0 flex-1 space-y-4">
        {(errorMessage || saved) && (
          <div className="space-y-3">
            {errorMessage && <Alert tone="error">{errorMessage}</Alert>}
            {saved && <Alert tone="success">Saved.</Alert>}
          </div>
        )}

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{selected.name}</h2>
            <p className="text-sm text-slate-500">{selected.description}</p>
          </div>
          {!editing && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </div>

        {editing ? (
          <form action={saveAction} className="space-y-3">
            <input type="hidden" name="mode" value={selected.key} />
            <div>
              <Label htmlFor={`prompt-${selected.key}`}>Personality prompt</Label>
              <Textarea
                id={`prompt-${selected.key}`}
                name="content"
                rows={22}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="min-h-[28rem] font-mono text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" size="sm">
                Save
              </Button>
              {selected.isCustomized && (
                <Button type="submit" formAction={resetAction} variant="secondary" size="sm">
                  Reset to default
                </Button>
              )}
              <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Card>
            <CardBody>
              <Markdown variant="document" className="max-w-none">
                {value}
              </Markdown>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
