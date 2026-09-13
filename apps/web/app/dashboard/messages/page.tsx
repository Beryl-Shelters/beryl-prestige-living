import { MessagesScreen } from "../../../components/dashboard/messages-screen";
import "./messages.css";

export default async function MessagesPage({searchParams}:{searchParams:Promise<{ticket?:string}>}) {
  const {ticket}=await searchParams;
  const initialTicket=typeof ticket==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ticket)?ticket:null;
  return <MessagesScreen initialTicket={initialTicket} />;
}
