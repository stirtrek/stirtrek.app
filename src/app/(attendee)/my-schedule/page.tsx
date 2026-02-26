import { redirect } from "next/navigation";

export default function MySchedulePage() {
  redirect("/schedule?tab=my-schedule");
}
