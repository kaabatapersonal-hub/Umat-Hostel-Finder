import { SubmitHostelForm } from "@/components/submit/submit-hostel-form";

export default function AdminAddHostelPage() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-h1 text-ink-900">Add Hostel</h1>
        <p className="text-body-sm text-ink-500">
          Goes live immediately — no submission queue. Only name, location, one room type + price, and a WhatsApp
          number are required; fill in the rest now or come back and edit later.
        </p>
      </div>
      <SubmitHostelForm mode={{ kind: "admin-create" }} />
    </div>
  );
}
