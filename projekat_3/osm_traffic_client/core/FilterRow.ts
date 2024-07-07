import { Attribute } from "../model/attribute";
import { DataType } from "../model/data-type";
import { Operator } from "../model/operator";
import { sanitaze } from "../util";
import {
  possibleOperators,
  shouldDynamicallyGenerateFilter,
} from "./filter-util";

export class FilterRow {
  private _rowIndex: number;
  private _attributes: Attribute[];

  private attributeSelect: HTMLSelectElement;
  private operatorSelect: HTMLSelectElement;
  private valueInput: HTMLInputElement;
  private addFilterBtn: HTMLButtonElement;
  private removeFilterBtn: HTMLButtonElement;
  private _container: HTMLDivElement;

  constructor(rowIndex: number, attributes: Attribute[]) {
    this._rowIndex = rowIndex;
    this._attributes = attributes;

    this._container = document.createElement("div");
    this.attributeSelect = document.createElement("select");
    this.operatorSelect = document.createElement("select");
    this.valueInput = document.createElement("input");
    this.addFilterBtn = document.createElement("button");
    this.removeFilterBtn = document.createElement("button");

    this.initialize();
  }

  public addEventListener(
    event: "addFilter" | "removeFilter" | "onEnter",
    listener: (e: any) => void
  ) {
    switch (event) {
      case "addFilter":
        this.addFilterBtn.addEventListener("click", () => listener(this));
        break;
      case "removeFilter":
        this.removeFilterBtn.addEventListener("click", () => listener(this));
        break;
      case "onEnter":
        this.valueInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            listener(e);
          }
        });
    }
  }

  public set rowIndex(rowIndex: number) {
    this._rowIndex = rowIndex;
  }

  public get rowIndex() {
    return this._rowIndex;
  }

  public get container(): HTMLDivElement {
    return this._container;
  }

  public get attribute(): Attribute {
    return this._attributes.find(
      (a) => a.name === this.attributeSelect.value
    )!!;
  }

  public get operator(): Operator {
    return this.operatorSelect.value as Operator;
  }

  public get value() {
    return this.valueInput.value;
  }

  public reset() {
    this.valueInput.value = "";
  }

  private initialize() {
    this.container.classList.add("filter-row");
    this.attributeSelect.classList.add("attribute-select");
    this.operatorSelect.classList.add("operator-select");
    this.valueInput.classList.add("filter-value");
    this.addFilterBtn.textContent = "+";
    this.removeFilterBtn.textContent = "-";

    this._attributes.forEach((attribute) => {
      if (!shouldDynamicallyGenerateFilter(attribute.dataType)) {
        return;
      }
      const option = document.createElement("option");
      option.value = attribute.name;
      option.textContent = sanitaze(attribute.name);
      this.attributeSelect.appendChild(option);
    });

    this.attributeSelect.addEventListener("change", (e: any) => {
      this.updateOperatorsAndInputField(
        this._attributes.find((a) => a.name === e.target.value) ?? null
      );
    });

    this.updateOperatorsAndInputField(this._attributes[0]);

    this._container.append(
      this.attributeSelect,
      this.operatorSelect,
      this.valueInput,
      this.addFilterBtn,
      this.removeFilterBtn
    );
  }

  private updateOperatorsAndInputField(val: Attribute | null) {
    if (!val) return;

    const operators = possibleOperators(val.dataType);
    this.operatorSelect.innerHTML = "";

    operators.forEach((operator) => {
      const option = document.createElement("option");
      option.value = operator;
      option.textContent = operator;
      this.operatorSelect.appendChild(option);
    });

    this.setInputType(val.dataType);
  }

  private setInputType(dataType: DataType) {
    switch (dataType) {
      case DataType.String:
        this.valueInput.type = "text";
        break;
      case DataType.Integer:
      case DataType.Long:
      case DataType.Float:
      case DataType.Double:
      case DataType.Decimal:
        this.valueInput.type = "number";
        break;
      case DataType.Date:
      case DataType.DateTime:
      case DataType.Time:
        this.valueInput.type = "datetime-local";
        break;
      default:
        this.valueInput.type = "text";
        break;
    }
  }
}
