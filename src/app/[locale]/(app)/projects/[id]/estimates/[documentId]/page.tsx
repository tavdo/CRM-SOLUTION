import { FinancialDocument } from "@/components/construction/FinancialDocument";
export default async function EstimatePrint({ params }: { params: Promise<{ locale: string; id: string; documentId: string }> }) {
  const { locale, id, documentId } = await params;
  return <FinancialDocument locale={locale} projectId={id} documentId={documentId} kind="estimate" />;
}
