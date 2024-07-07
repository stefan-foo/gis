import { Feature, Map, Overlay, View } from "ol";
import { Extent } from "ol/extent";
import GeoJSON from "ol/format/GeoJSON";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import { bbox as bboxStrategy } from "ol/loadingstrategy";
import { fromLonLat } from "ol/proj";
import OSM from "ol/source/OSM";
import VectorSource from "ol/source/Vector";
import { GEOSERVER_URI, WORKSPACE } from "./constants";
import { FilterPanel } from "./core/FilterPanel";
import { convertToCql, getCql, getGeometryAttribute } from "./core/filter-util";
import { Attribute } from "./model/attribute";
import { DataType } from "./model/data-type";
import { Filter } from "./model/filter";
import { LayerInfo } from "./model/layer-info";
import "./style.css";
import {
  createTileLayer,
  getWFSLayersInfo,
  getWMSLayersInfo,
} from "./core/layer-util";
import { styles } from "./layer-styles";
import { sanitaze, sanitazeValue } from "./util";
import { Coordinate } from "ol/coordinate";
import { Pixel } from "ol/pixel";
import { TileWMS } from "ol/source";
import { LanguageServiceMode } from "typescript";
import { ParamsPanel } from "./core/ParamsPanel";

const legend = document.getElementById("legend")!!;
const popup = new Overlay({
  element: document.getElementById("popup") ?? undefined,
  autoPan: true,
});

const map = new Map({
  target: "map",
  layers: [
    new TileLayer({
      source: new OSM(),
    }),
  ],
  view: new View({
    center: fromLonLat([20.4612, 44.8125]),
    zoom: 10.8,
  }),
  overlays: [popup],
});

map.on("singleclick", async (evt) => {
  const featurePromises = map
    .getAllLayers()
    .slice(1)
    .filter((layer) => layer.isVisible())
    .toReversed()
    .map((layer) => {
      if (layer instanceof VectorLayer) {
        return Promise.resolve(
          getFirstFeatureFromVectorLayer(layer, evt.pixel)
        );
      } else if (layer instanceof TileLayer) {
        return getFirstFeatureFromTileLayer(layer, evt.coordinate);
      } else {
        return Promise.resolve(null);
      }
    });

  const feature = (await Promise.all(featurePromises)).find((f) => f !== null);

  if (!feature) {
    popup.setPosition(undefined);
    return;
  }

  const props =
    feature instanceof Feature ? feature.getProperties() : feature.properties;

  displayDetailsPopUp(evt.coordinate, props);
});

function createVectorLayer(
  layer: LayerInfo,
  filters: FilterPanel,
  params: ParamsPanel | null
) {
  return new VectorLayer({
    source: new VectorSource({
      format: new GeoJSON(),
      url: (extent) => {
        const cql = getCql(layer, filters.getFilters(), extent);
        const viewParams = params != null ? params.paramString : null;
        if (cql) {
          return `${GEOSERVER_URI}/${WORKSPACE}/wfs?service=WFS&request=GetFeature&typename=${
            layer.name
          }&outputFormat=application/json&srsname=EPSG:3857${
            viewParams ? `&VIEWPARAMS=${viewParams}` : ""
          }&cql_filter=${encodeURI(cql)}`;
        }

        return `${GEOSERVER_URI}/${WORKSPACE}/wfs?service=WFS&request=GetFeature&typename=${
          layer.name
        }&outputFormat=application/json&srsname=EPSG:3857${
          viewParams ? `&VIEWPARAMS=${viewParams}` : ""
        }&bbox=${extent.join(",")},EPSG:3857`;
      },
      strategy: bboxStrategy,
    }),
    style: styles[layer.name],
  });
}

function addLayerControl(
  layer: VectorLayer<any> | TileLayer<TileWMS>,
  layerInfo: LayerInfo,
  paramsPanel: ParamsPanel | null,
  filterPanel: FilterPanel | null
) {
  const layerControl = document.createElement("div");
  layerControl.classList.add("layer-control");

  const header = document.createElement("div");
  header.classList.add("layer-header");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = layer.getVisible();
  checkbox.addEventListener("change", (e: Event) => {
    layer.setVisible((e.target as HTMLInputElement).checked);
    console.log(layer.isVisible());
  });

  const label = document.createElement("span");
  label.textContent = layerInfo.title;

  const dropdownButton = document.createElement("button");
  dropdownButton.textContent = "▼";
  dropdownButton.classList.add("dropdown-button");
  dropdownButton.addEventListener("click", () => {
    layerDetails.classList.toggle("show");
  });

  header.appendChild(checkbox);
  header.appendChild(label);
  header.appendChild(dropdownButton);
  layerControl.appendChild(header);

  const layerDetails = document.createElement("div");
  layerDetails.classList.add("layer-details");

  if (paramsPanel) {
    layerDetails.appendChild(paramsPanel.container);
  }

  if (filterPanel) {
    layerDetails.appendChild(filterPanel.container);
    filterPanel.addEventListener("refresh", () => {
      layer.getSource()?.refresh();
    });
  }

  const refreshButton = document.createElement("button");
  refreshButton.textContent = "Refresh";
  refreshButton.addEventListener("click", () => {
    if (layer instanceof TileLayer) {
      layer.getSource()?.updateParams({ VIEWPARAMS: paramsPanel?.paramString });
    }
    layer.getSource()?.refresh();
  });
  layerDetails.appendChild(refreshButton);

  layerControl.appendChild(layerDetails);
  legend.appendChild(layerControl);
}

async function initializeLayers() {
  const wfsLayersInfo = await getWFSLayersInfo();
  const wmsLayersInfo = await getWMSLayersInfo();

  let group = document.createElement("H4");
  group.textContent = "WFS";
  legend.appendChild(group);
  wfsLayersInfo.forEach((layerInfo) => {
    const paramsPanel =
      layerInfo.viewParams.length > 0 ? new ParamsPanel(layerInfo) : null;
    const filterPanel = new FilterPanel(layerInfo);
    const layer = createVectorLayer(layerInfo, filterPanel, paramsPanel);
    layer.setVisible(false);
    layer.set("name", `${layerInfo.service}-${layerInfo.name}`);
    map.addLayer(layer);
    addLayerControl(layer, layerInfo, paramsPanel, filterPanel);
  });

  group = document.createElement("H4");
  group.textContent = "WMS";
  legend.appendChild(group);
  wmsLayersInfo.forEach((layerInfo) => {
    const paramsPanel =
      layerInfo.viewParams.length > 0 ? new ParamsPanel(layerInfo) : null;
    const layer = createTileLayer(layerInfo, paramsPanel);
    layer.setVisible(false);
    layer.set("name", `${layerInfo.service}-${layerInfo.name}`);
    map.addLayer(layer);
    addLayerControl(layer, layerInfo, paramsPanel, null);
  });
}

function getFirstFeatureFromVectorLayer(layer: VectorLayer<any>, pixel: Pixel) {
  const features = map.getFeaturesAtPixel(pixel);
  return features.length ? features[0] : null;
}

async function getFirstFeatureFromTileLayer(
  layer: TileLayer<any>,
  pixel: Pixel
) {
  const viewResolution = map.getView().getResolution();

  if (!viewResolution) return null;

  const url = layer
    ?.getSource()
    ?.getFeatureInfoUrl(pixel, viewResolution, "EPSG:3857", {
      INFO_FORMAT: "application/json",
    });

  if (!url) return null;

  const response = await fetch(url);
  const features = (await response.json()).features;

  return features.length > 0 ? features[0] : null;
}

function displayDetailsPopUp(coordinate: Coordinate, props: any) {
  let info = "";
  for (const [key, value] of Object.entries(props)) {
    if (
      !value ||
      key == "way" ||
      (typeof value !== "string" && typeof value !== "number")
    ) {
      continue;
    }

    info = info.concat(`${sanitaze(key)}: ${sanitazeValue(key, value)}<br>`);
  }

  const popupContent = document.getElementById("popup-content");
  if (popupContent) {
    popupContent.innerHTML = info;
  }

  popup.setPosition(coordinate);
}

initializeLayers();
