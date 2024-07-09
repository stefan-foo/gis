import { LayerInfo } from "../model/layer-info";
import { ParamDataType } from "../model/param-data-type";
import { sanitaze } from "../util";

export class ParamsPanel {
  private layer: LayerInfo;
  private _container: HTMLDivElement;

  constructor(layer: LayerInfo) {
    this.layer = layer;

    this._container = document.createElement("div");
    this._container.classList.add("params-panel");

    this.initialize();
  }

  public get container() {
    return this._container;
  }

  private initialize() {
    this.layer.viewParams.forEach((param) => {
      const row = document.createElement("div");

      const label = document.createElement("label");
      label.textContent = sanitaze(param.name);

      const input = document.createElement("input");
      input.type = this.getInputType(param.dataType);
      input.name = param.name;

      row.append(label, input);
      this._container.appendChild(row);
    });
  }

  public get paramString(): string {
    const values: Record<string, any> = this.values;
    const valueStrings = Object.entries(values)
      .filter((v) => v[1])
      .map(([key, value]) => `${key}:${value}`);

    if (valueStrings.length == 0) {
      return "";
    }

    return valueStrings.join(";");
  }

  public get values(): Record<string, any> {
    const values: Record<string, any> = {};
    const inputs = this._container.querySelectorAll("input");

    inputs.forEach((input) => {
      const paramName = input.name;
      const value = (input as HTMLInputElement).value;
      values[paramName] = value;
    });

    return values;
  }

  private getInputType(dataType: ParamDataType): string {
    switch (dataType) {
      case ParamDataType.String:
        return "text";
      case ParamDataType.Integer:
        return "number";
      default:
        return "text";
    }
  }
}
