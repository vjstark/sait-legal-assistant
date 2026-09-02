import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { saveLearningPreferences } from "@/app/actions/onboarding";
import {
  Alert,
  Button,
  Card,
  CardBody,
  Label,
  PageHeader,
  Textarea,
} from "@/components/ui";

function RadioOption({
  name,
  value,
  defaultChecked,
  title,
  detail,
}: {
  name: string;
  value: string;
  defaultChecked?: boolean;
  title: string;
  detail?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface p-3.5 transition-colors hover:border-brand-200 has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="mt-0.5 accent-brand-700"
      />
      <span className="text-sm">
        <span className="block font-medium text-brand-900">{title}</span>
        {detail && <span className="mt-0.5 block text-slate-500">{detail}</span>}
      </span>
    </label>
  );
}

export default async function LearningPreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorMessage } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("learning_preferences")
    .eq("id", user.id)
    .single();

  const prefs = (profile?.learning_preferences ?? {}) as {
    explanationStyle?: string;
    quizFrequency?: string;
    priorBackground?: string;
  };

  return (
    <>
      <PageHeader
        title="Learning preferences"
        description="How the tutor explains things and quizzes you. Change these anytime."
      />

      <div className="max-w-2xl space-y-6">
        {errorMessage && <Alert tone="error">{errorMessage}</Alert>}

        <Card>
          <CardBody>
            <form action={saveLearningPreferences} className="space-y-6">
              <input
                type="hidden"
                name="_referer"
                value="/settings/learning-preferences"
              />

              <fieldset>
                <legend className="mb-2.5 text-sm font-medium text-brand-900">
                  When explaining something, I prefer:
                </legend>
                <div className="space-y-2.5">
                  <RadioOption
                    name="explanationStyle"
                    value="brief"
                    defaultChecked={prefs.explanationStyle === "brief"}
                    title="Brief"
                    detail="Get to the point"
                  />
                  <RadioOption
                    name="explanationStyle"
                    value="detailed"
                    defaultChecked={prefs.explanationStyle !== "brief"}
                    title="Detailed"
                    detail="Walk me through it"
                  />
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2.5 text-sm font-medium text-brand-900">
                  I like being quizzed:
                </legend>
                <div className="space-y-2.5">
                  <RadioOption
                    name="quizFrequency"
                    value="frequent"
                    defaultChecked={prefs.quizFrequency === "frequent"}
                    title="Frequently, as I go"
                  />
                  <RadioOption
                    name="quizFrequency"
                    value="after_reading"
                    defaultChecked={prefs.quizFrequency !== "frequent"}
                    title="After I've read/reviewed the material"
                  />
                </div>
              </fieldset>

              <div>
                <Label htmlFor="priorBackground">
                  Prior background in this subject (optional)
                </Label>
                <Textarea
                  id="priorBackground"
                  name="priorBackground"
                  rows={3}
                  defaultValue={prefs.priorBackground ?? ""}
                />
              </div>

              <Button type="submit">Save</Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
