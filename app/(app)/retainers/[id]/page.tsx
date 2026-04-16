import RetainerDetailPage from "./RetainerDetailPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RetainerDetailPage id={id} />;
}
