import { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { DocumentPickerComponent } from "../document-picker";
import { Button, Card, SectionHeading } from "../ui";
import { friendlyError } from "@/lib/api-error";
import type { PickedFile } from "@/lib/file-upload-helper";
import { listingsApi, type CustomerListing, type PhysicalMandate } from "@/lib/listings-api";
import { downloadAndOpenMandate } from "@/lib/mandate-download";
import { useTheme } from "@/providers/theme-provider";
import { spacing, typography, type ColorTokens } from "@/theme/tokens";

type Props={listing:CustomerListing;onBack:()=>void;onSubmitSuccess:(listing:CustomerListing)=>void};
const progress=["Property details saved","Print and sign mandate","Upload signed mandate","Admin reviews documents","Property approved for sale"];

export function SalesMandateStep({listing,onBack,onSubmitSuccess}:Props){
  const {colors}=useTheme(),styles=useMemo(()=>createStyles(colors),[colors]);
  const [mandate,setMandate]=useState<PhysicalMandate|null>(null),[files,setFiles]=useState<{file:PickedFile;title:string}[]>([]),[loading,setLoading]=useState(true),[pending,setPending]=useState(false),[error,setError]=useState("");
  useEffect(()=>{let active=true;void(async()=>{try{let value=await listingsApi.getPhysicalMandate(listing.id);if(!value)value=await listingsApi.preparePhysicalMandate(listing.id);if(active)setMandate(value);}catch(failure){if(active)setError(friendlyError(failure));}finally{if(active)setLoading(false);}})();return()=>{active=false;};},[listing.id]);
  async function download(){setPending(true);setError("");try{await downloadAndOpenMandate(listing.id,listing.listing_code);}catch(failure){setError(friendlyError(failure));}finally{setPending(false);}}
  async function resend(){setPending(true);setError("");try{await listingsApi.resendPhysicalMandate(listing.id);setMandate(await listingsApi.getPhysicalMandate(listing.id));}catch(failure){setError(friendlyError(failure));}finally{setPending(false);}}
  async function upload(){if(!mandate||!files.length)return;setPending(true);setError("");try{const result=await listingsApi.uploadPhysicalMandate(listing.id,mandate.version_id,files.map(item=>item.file));setMandate(result.mandate);setFiles([]);onSubmitSuccess(result.listing);}catch(failure){setError(friendlyError(failure));}finally{setPending(false);}}
  if(loading)return <View style={styles.loading}><Text style={styles.body}>Preparing your Sales Mandate…</Text></View>;
  if(!mandate)return <View style={styles.loading}><Text style={styles.error}>{error||"Your property is saved, but the Sales Mandate could not be prepared."}</Text><Button label="Back to Property Data" variant="secondary" onPress={onBack}/></View>;
  const canUpload=mandate.status==="AWAITING_UPLOAD"||mandate.status==="REJECTED";
  return <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled"><SectionHeading title="Your Sales Mandate Is Ready" description="Print, complete and sign the document by hand before uploading it."/>
    <Card><Text style={styles.title}>BERYL SHELTER NIGERIA LIMITED</Text><Text style={styles.body}>{mandate.email_status==="SENT"?"We've emailed your Sales Mandate to your registered email address.":"Your Sales Mandate is ready, but we couldn't send the email. Download it below or try resending."}</Text><Text style={styles.meta}>Registered email: {mandate.registered_email??"Your registered account email"}</Text><Text style={styles.meta}>Property reference: {mandate.property_reference??listing.listing_code}</Text><Text style={styles.meta}>Agreement version: {mandate.agreement_version}</Text><Text style={styles.body}>Download the complete Sales Mandate, print it, fill in any missing details and sign it by hand using a pen. Then upload the complete signed document for review.</Text>{progress.map((item,index)=><Text key={item} style={styles.step}>{index+1}. {item}</Text>)}<View style={styles.actions}><Button label="Download Mandate" onPress={()=>void download()} disabled={pending}/><Button label="Resend Email" variant="secondary" onPress={()=>void resend()} disabled={pending}/></View></Card>
    {mandate.status==="UNDER_REVIEW"&&<Card><Text style={styles.title}>Signed Mandate Under Review</Text><Text style={styles.body}>Your document has been received and is awaiting Admin review.</Text></Card>}
    {mandate.status==="APPROVED"&&<Card><Text style={styles.title}>Mandate Approved</Text><Text style={styles.body}>Your signed mandate is approved. Existing property review requirements still apply.</Text></Card>}
    {mandate.status==="REJECTED"&&<Card><Text style={styles.title}>Mandate Needs Correction</Text><Text style={styles.error}>{mandate.rejection_reason}</Text></Card>}
    {canUpload&&<Card><DocumentPickerComponent label={mandate.status==="REJECTED"?"Upload Corrected Signed Mandate":"Upload Signed Mandate"} helper="Upload the complete signed document as PDF, JPEG or PNG files in page order (10 MB each)." maxCount={24} multiple files={files} onFilesChange={setFiles}/><Button label={pending?"Uploading…":"Upload for Admin Review"} onPress={()=>void upload()} disabled={pending||!files.length}/></Card>}
    {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}<Button label="Back to Property Data" variant="secondary" onPress={onBack}/>
  </ScrollView>;
}

function createStyles(colors:ColorTokens){return StyleSheet.create({container:{padding:spacing.lg,gap:spacing.md,backgroundColor:colors.background},loading:{padding:spacing.xl,gap:spacing.md,backgroundColor:colors.background,flex:1},title:{...typography.heading,color:colors.brand,marginBottom:spacing.sm},body:{...typography.body,color:colors.text,marginBottom:spacing.sm},meta:{...typography.caption,color:colors.textMuted,marginBottom:spacing.xs},step:{...typography.body,color:colors.text,paddingVertical:spacing.xs},actions:{gap:spacing.sm,marginTop:spacing.md},error:{...typography.body,color:colors.danger}});}
