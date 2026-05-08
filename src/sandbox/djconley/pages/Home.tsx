import SiteLayout from "../SiteLayout";
import PageRenderer from "../PageRenderer";

export default function DJHome() {
  return (
    <SiteLayout>
      <PageRenderer slug="home" />
    </SiteLayout>
  );
}
