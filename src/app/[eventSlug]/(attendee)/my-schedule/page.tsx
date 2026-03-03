import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ eventSlug: string }>;
}

export default async function MySchedulePage({ params }: PageProps) {
  const { eventSlug } = await params;
  redirect(`/${eventSlug}/schedule?tab=my-schedule`);
}
