import { Filter } from "../model/filter";
import { LayerInfo } from "../model/layer-info";
import { FilterRow } from "./FilterRow";

export class FilterPanel {
  private layer: LayerInfo;
  private filters: FilterRow[] = [];
  private _container: HTMLDivElement;
  private _changeListeners: ((e: any) => void)[] = [];

  constructor(layer: LayerInfo) {
    this.layer = layer;

    this._container = document.createElement("div");

    this.initialize();
  }

  public get container() {
    return this._container;
  }

  public getFilters(): Filter[] {
    return this.filters
      .filter((f) => f.value)
      .map((filter) => ({
        attribute: filter.attribute,
        operator: filter.operator,
        value: filter.value,
      }));
  }

  public addEventListener(event: "refresh", listener: (e: any) => void) {
    this._changeListeners.push(listener);
  }

  private initialize() {
    this._container.classList.add("filter-panel");

    const removeFilter = (row: FilterRow) => {
      if (this.filters.length == 1) {
        this.filters[0].reset();
        return;
      }

      this.filters.splice(row.rowIndex, 1);
      this._container.removeChild(row.container);
      this.refreshRowIds();
    };

    const addFilter = (addAfter: FilterRow | null = null) => {
      const row = new FilterRow(this.filters.length, this.layer.attributes);
      row.addEventListener("addFilter", addFilter);
      row.addEventListener("removeFilter", removeFilter);
      row.addEventListener("onEnter", (e) =>
        this._changeListeners.forEach((cb) => cb(e))
      );
      if (addAfter !== null) {
        const index = addAfter.rowIndex + 1;
        this.filters.splice(index, 0, row);
        addAfter.container.after(row.container);
      } else {
        this.filters.push(row);
        this._container.append(row.container);
      }
      this.refreshRowIds();
    };
    addFilter();
  }

  private refreshRowIds() {
    let index = 0;
    for (const filter of this.filters) {
      filter.rowIndex = index++;
    }
  }
}
