import {CustomerAnswer} from "./customer-answer";

export default async function CustomerPage({params}: PageProps<"/c/[id]">) {
    const {id} = await params;
    return <CustomerAnswer id={id}/>;
}
