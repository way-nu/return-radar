import {ClaimDetailView} from "./claim-detail";

export default async function ClaimPage({params}: PageProps<"/console/claims/[id]">) {
    const {id} = await params;
    return <ClaimDetailView id={id}/>;
}
