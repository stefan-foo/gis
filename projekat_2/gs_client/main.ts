import { Map, Overlay, View } from "ol";
import { Coordinate } from "ol/coordinate";
import Layer from "ol/layer/Layer";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import { fromLonLat } from "ol/proj";
import OSM from "ol/source/OSM";
import {
  createTileLayer,
  createVectorLayer,
  getWFSLayersInfo,
  getWMSLayersInfo,
} from "./geoserver-layer-util";
import { LayerInfo } from "./model/layer-info";
import "./style.css";
import { Pixel } from "ol/pixel";
import Feature from "ol/Feature";
import { GEOSERVER_URI, WORKSPACE, keywords } from "./constants";
import { ImageWMS, TileWMS } from "ol/source";
import ImageLayer from "ol/layer/Image";

const legend: HTMLElement = document.getElementById("legend")!!;
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
    center: fromLonLat([20.4, 44.05]),
    zoom: 7.4,
  }),
  overlays: [popup],
});

const wmsLayers =
  (await getWMSLayersInfo())?.filter(
    (layer) => !layer.keywords.includes(keywords.hide_wms)
  ) ?? [];
const wfsLayers = (await getWFSLayersInfo()) ?? [];

if (wfsLayers?.length > 0) {
  const wmsHeader = document.createElement("H4");
  wmsHeader.textContent = "WMS Layers";
  legend.appendChild(wmsHeader);
}

wmsLayers?.forEach(initLayer);

if (wfsLayers?.length > 0) {
  const wfsHeader = document.createElement("H4");
  wfsHeader.textContent = "WFS Layers";
  legend.appendChild(wfsHeader);
}

wfsLayers
  .filter((el) => !el.keywords.includes(keywords.powerplant))
  .forEach(initLayer);

const wfsHeader = document.createElement("hr");
legend.appendChild(wfsHeader);

wfsLayers
  .filter((el) => el.keywords.includes(keywords.powerplant))
  .forEach(initLayer);

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

function initLayer(layerInfo: LayerInfo) {
  const item = document.createElement("div");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = false;

  let layer: Layer;
  if (layerInfo.service == "WMS") {
    layer = createTileLayer(layerInfo);
  } else {
    layer = createVectorLayer(layerInfo);
  }
  layer.setVisible(false);
  map.addLayer(layer);

  checkbox.addEventListener("change", (_) => {
    layer.setVisible(checkbox.checked);
    popup.setPosition(undefined);
  });
  item.appendChild(checkbox);
  item.appendChild(document.createTextNode(layerInfo.title));
  legend.appendChild(item);
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

function sanitaze(key: string): string {
  return capitalize(key.replace(/[:_]/g, " "));
}

function sanitazeValue(key: string, value: string | number): string {
  if (typeof value === "string" && key !== "ele") {
    return sanitaze(value);
  }

  const numberValue = value as number;

  const searchableKey = key.toLocaleLowerCase();
  if (searchableKey.indexOf("area") >= 0) {
    return numberValue < 1000000
      ? `${numberValue} m²`
      : `${(numberValue / 1000000).toFixed(2)} km²`;
  } else if (searchableKey.indexOf("ele") >= 0) {
    return `${numberValue} m`;
  }

  return value.toString();
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
