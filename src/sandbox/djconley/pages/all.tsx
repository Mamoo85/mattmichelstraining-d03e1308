import SiteLayout from "../SiteLayout";
import PageRenderer from "../PageRenderer";
import DJContact from "./Contact";

const make = (slug: string, title: string) => () => (
  <SiteLayout title={title}>
    <PageRenderer slug={slug} title={title} />
  </SiteLayout>
);

export { DJContact as Contact };

export const About = make("about", "About Us");
export const Industries = make("industries", "Industries");
export const Service = make("service", "Service");
export const Parts = make("parts", "Parts");
export const Products = make("products", "Manufacturers");
export const Projects = make("projects", "Projects");
export const Rentals = make("rentals", "Boiler Rentals");
export const Education = make("education", "Training & Education");
export const Resources = make("resources", "Resources");
export const Careers = make("careers", "Careers");
export const Contact = make("contact", "Contact");
export const NewBoilerSolutions = make("new-boiler-solutions", "New Boiler Solutions");
export const BoilerAccessories = make("boiler-accessories", "Boiler Accessories");
export const BoilerBurners = make("boiler-burners", "Boiler Burners");
export const BoilerControls = make("boiler-controls", "Boiler Controls");
export const HeatRecovery = make("heat-recovery", "Heat Recovery");
export const ExhaustSolutions = make("exhaust-solutions", "Exhaust Solutions");
