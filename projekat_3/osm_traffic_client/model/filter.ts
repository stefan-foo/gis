import { Attribute } from "./attribute";
import { Operator } from "./operator";

export interface Filter {
  attribute: Attribute;
  operator: Operator;
  value: any;
}
