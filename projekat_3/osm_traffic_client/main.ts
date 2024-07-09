import { Feature, Map, Overlay, View } from "ol";
import { Coordinate } from "ol/coordinate";
import ImageLayer from "ol/layer/Image";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import { Pixel } from "ol/pixel";
import { fromLonLat } from "ol/proj";
import { ImageWMS, TileWMS } from "ol/source";
import OSM from "ol/source/OSM";
import { FilterPanel } from "./core/FilterPanel";
import { ParamsPanel } from "./core/ParamsPanel";
import {
  createImageLayer,
  createTileLayer,
  createVectorLayer,
  getWFSLayersInfo,
  getWMSLayersInfo,
} from "./core/layer-util";
import { LayerInfo } from "./model/layer-info";
import "./style.css";
import { sanitaze, sanitazeValue } from "./util";

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
      } else if (layer instanceof TileLayer || layer instanceof ImageLayer) {
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

function addLayerControl(
  layer: VectorLayer<any> | TileLayer<TileWMS> | ImageLayer<ImageWMS>,
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
    if (layer instanceof TileLayer || layer instanceof ImageLayer) {
      layer.getSource()?.updateParams({ VIEWPARAMS: paramsPanel?.paramString });
    }
    layer.setVisible((e.target as HTMLInputElement).checked);
  });

  const label = document.createElement("span");
  label.textContent = layerInfo.title;

  header.appendChild(checkbox);
  header.appendChild(label);

  const noFilters = paramsPanel == null && filterPanel == null;
  if (noFilters) {
    layerControl.appendChild(header);
    legend.appendChild(layerControl);
    return;
  }

  const dropdownButton = document.createElement("button");
  dropdownButton.append(document.createTextNode("▼"));
  dropdownButton.classList.add("dropdown-button");
  dropdownButton.addEventListener("click", () => {
    dropdownButton.classList.toggle("sideways");
    layerDetails.classList.toggle("show");
  });

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
    if (layer instanceof TileLayer || layer instanceof ImageLayer) {
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
  group.textContent = "WFS layers";
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
  group.textContent = "WMS layers";
  legend.appendChild(group);
  wmsLayersInfo
    .filter((l) => !l.keywords.includes("hide_wms"))
    .forEach((layerInfo) => {
      const paramsPanel =
        layerInfo.viewParams.length > 0 ? new ParamsPanel(layerInfo) : null;
      let layer;
      if (layerInfo.keywords.includes("layer:image")) {
        layer = createImageLayer(layerInfo, paramsPanel);
      } else {
        layer = createTileLayer(layerInfo, paramsPanel);
      }
      layer.setVisible(false);
      layer.set("name", `${layerInfo.service}-${layerInfo.name}`);
      map.addLayer(layer);
      addLayerControl(layer, layerInfo, paramsPanel, null);
    });
}

async function getFirstFeatureFromTileLayer(
  layer: TileLayer<any> | ImageLayer<ImageWMS>,
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

function getFirstFeatureFromVectorLayer(layer: VectorLayer<any>, pixel: Pixel) {
  const features = map.getFeaturesAtPixel(pixel);
  return features.length ? features[0] : null;
}

initializeLayers();
