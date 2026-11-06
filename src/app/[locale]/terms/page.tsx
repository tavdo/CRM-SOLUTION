import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/config";
import { PublicInformation, informationTitles } from "@/components/PublicInformation";
import { publicMetadata } from "@/lib/metadata";
export async function generateMetadata({params}:{params:Promise<{locale:string}>}) { const {locale}=await params; if(!isLocale(locale)) notFound(); return publicMetadata(locale,"/terms",informationTitles[locale].terms); }
export default async function Page({params}:{params:Promise<{locale:string}>}) {const {locale}=await params;if(!isLocale(locale))notFound();return <PublicInformation locale={locale} kind="terms"/>;}
