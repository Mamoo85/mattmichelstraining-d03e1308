import { Routes, Route, useParams } from "react-router-dom";
import LoginGate, { LoginScreen } from "./admin/LoginGate";
import Overview from "./admin/Overview";
import WidgetsPage from "./admin/Widgets";
import SiteVersions from "./admin/SiteVersions";
import {
  SiteRadarTab, MissedCallTab, BuyerRadarTab, FieldDeskTab, TechAlertTab,
  TradeRadarTab, OutreachTab, ReviewsTab, ReportsTab, IntegrationsTab, TeamTab, SettingsTab,
} from "./admin/tabs";

import { getVersion } from "./landings/registry";
import { getSiteVersion } from "./landings/useSiteVersion";

/** Public home — renders whichever landing version is currently selected. */
function DJHomeSelected() {
  const { Component } = getVersion(getSiteVersion());
  return <Component />;
}

/** Preview a specific landing version by id (e.g. /v/authority, /v/2). */
function DJHomePreview() {
  const { versionId } = useParams();
  const byNum: Record<string, string> = { "1": "classic", "2": "authority", "3": "service", "4": "modern" };
  const id = versionId && byNum[versionId] ? byNum[versionId] : versionId;
  const { Component } = getVersion(id);
  return <Component />;
}
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import AdminTour from "./pages/AdminTour";
import {
  About, Industries, Service, Parts, Products, Projects, Rentals,
  Education, Resources, Careers, Contact,
  NewBoilerSolutions, BoilerAccessories, BoilerBurners, BoilerControls,
  HeatRecovery, ExhaustSolutions,
} from "./pages/all";

/** Mounted at /sandbox/djconley/* */
export default function DJConleySandbox() {
  return (
    <Routes>
      {/* Public-facing site mirror */}
      <Route index element={<DJHomeSelected />} />
      <Route path="v/:versionId" element={<DJHomePreview />} />
      <Route path="about" element={<About />} />
      <Route path="industries" element={<Industries />} />
      <Route path="service" element={<Service />} />
      <Route path="parts" element={<Parts />} />
      <Route path="products" element={<Products />} />
      <Route path="projects" element={<Projects />} />
      <Route path="rentals" element={<Rentals />} />
      <Route path="education" element={<Education />} />
      <Route path="resources" element={<Resources />} />
      <Route path="careers" element={<Careers />} />
      <Route path="contact" element={<Contact />} />
      <Route path="new-boiler-solutions" element={<NewBoilerSolutions />} />
      <Route path="boiler-accessories" element={<BoilerAccessories />} />
      <Route path="boiler-burners" element={<BoilerBurners />} />
      <Route path="boiler-controls" element={<BoilerControls />} />
      <Route path="heat-recovery" element={<HeatRecovery />} />
      <Route path="exhaust-solutions" element={<ExhaustSolutions />} />
      <Route path="blog" element={<Blog />} />
      <Route path="blog/:slug" element={<BlogPost />} />
      <Route path="tour" element={<AdminTour />} />



      {/* Admin Command Center */}
      <Route path="admin/login" element={<LoginScreen />} />
      <Route path="admin" element={<LoginGate><Overview /></LoginGate>} />
      <Route path="admin/site-radar"   element={<LoginGate><SiteRadarTab /></LoginGate>} />
      <Route path="admin/missed-call"  element={<LoginGate><MissedCallTab /></LoginGate>} />
      <Route path="admin/buyer-radar"  element={<LoginGate><BuyerRadarTab /></LoginGate>} />
      <Route path="admin/fielddesk"    element={<LoginGate><FieldDeskTab /></LoginGate>} />
      <Route path="admin/techalert"    element={<LoginGate><TechAlertTab /></LoginGate>} />
      <Route path="admin/trade-radar"  element={<LoginGate><TradeRadarTab /></LoginGate>} />
      <Route path="admin/outreach"     element={<LoginGate><OutreachTab /></LoginGate>} />
      <Route path="admin/reviews"      element={<LoginGate><ReviewsTab /></LoginGate>} />
      <Route path="admin/widgets"      element={<LoginGate><WidgetsPage /></LoginGate>} />
      <Route path="admin/site-versions" element={<LoginGate><SiteVersions /></LoginGate>} />
      <Route path="admin/reports"      element={<LoginGate><ReportsTab /></LoginGate>} />
      <Route path="admin/integrations" element={<LoginGate><IntegrationsTab /></LoginGate>} />
      <Route path="admin/team"         element={<LoginGate><TeamTab /></LoginGate>} />
      <Route path="admin/settings"     element={<LoginGate><SettingsTab /></LoginGate>} />
    </Routes>
  );
}
