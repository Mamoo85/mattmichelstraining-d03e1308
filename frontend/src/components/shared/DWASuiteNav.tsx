import { Link } from "react-router-dom";

const DWASuiteNav = () => (
  <nav className="flex items-center gap-4 text-sm text-muted-foreground">
    <Link to="/dwa-admin" className="hover:text-foreground">Admin</Link>
    <Link to="/dwa-admin/services" className="hover:text-foreground">Services</Link>
    <Link to="/dwa-admin/shorts" className="hover:text-foreground">Shorts</Link>
  </nav>
);
export default DWASuiteNav;
