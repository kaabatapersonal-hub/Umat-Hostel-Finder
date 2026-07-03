import { PlusCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export default function SubmitPage() {
  return (
    <div className="flex flex-col px-4 pt-6">
      <EmptyState
        icon={<PlusCircle className="size-7" strokeWidth={1.75} />}
        title="Submit a hostel — coming in Session 8"
        description="Managers and students will be able to add a hostel here, with the same image pipeline and room-type pricing used everywhere else in the app."
        className="bg-surface shadow-card"
      />
    </div>
  );
}
