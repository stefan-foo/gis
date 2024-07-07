import { Attribute } from "./attribute";
import { ViewParam } from "./view-param";

export interface LayerInfo {
  name: string;
  title: string;
  keywords: string[];
  attributes: Attribute[];
  viewParams: ViewParam[];
  service: "WMS" | "WFS";
}
