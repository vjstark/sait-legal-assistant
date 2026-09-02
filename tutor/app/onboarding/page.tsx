import { saveLearningPreferences } from "@/app/actions/onboarding";
import { Alert, Button, Card, CardBody, Label, Textarea } from "@/components/ui";

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

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error: errorMessage } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <p className="font-serif text-lg font-semibold tracking-tight text-brand-900">
            <span aria-hidden className="text-accent-700">
              §
            </span>{" "}
            Law Study Tutor
          </p>
          <h1 className="mt-3 text-3xl font-semibold">Tell us how you learn</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            This helps the tutor adapt to you specifically — you can change
            these anytime in Settings.
          </p>
        </div>

        {errorMessage && <Alert tone="error">{errorMessage}</Alert>}

        <Card>
          <CardBody>
            <form action={saveLearningPreferences} className="space-y-6">
              <input type="hidden" name="_referer" value="/onboarding" />

              <fieldset>
                <legend className="mb-2.5 text-sm font-medium text-brand-900">
                  When explaining something, I prefer:
                </legend>
                <div className="space-y-2.5">
                  <RadioOption
                    name="explanationStyle"
                    value="brief"
                    title="Brief"
                    detail="Get to the point"
                  />
                  <RadioOption
                    name="explanationStyle"
                    value="detailed"
                    defaultChecked
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
                    title="Frequently, as I go"
                  />
                  <RadioOption
                    name="quizFrequency"
                    value="after_reading"
                    defaultChecked
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
                  placeholder="e.g. this is my first law course, or I've studied contract law before"
                />
              </div>

              <Button type="submit" className="w-full">
                Continue
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </main>
  );
}
