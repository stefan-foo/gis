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

const legend = document.getElementsByClassName("legend")[0];
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
    center: fromLonLat([20.5, 44.0]),
    zoom: 7.7,
  }),
  overlays: [popup],
});

const wmsLayers = (await getWMSLayersInfo()) ?? [];
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

wfsLayers.forEach(initLayer);

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

map.on("singleclick", function (evt) {
  const priorityLayer = map
    .getAllLayers()
    .slice(1)
    .find((l) => l.isVisible());

  if (priorityLayer instanceof VectorLayer) {
    const features = map.getFeaturesAtPixel(evt.pixel);
    if (features.length == 0) {
      popup.setPosition(undefined);
      return;
    }

    displayDetailsPopUp(evt.coordinate, features[0].getProperties());
    return;
  }

  const viewResolution = map.getView().getResolution();

  if (!viewResolution) return;

  const layer: TileLayer<any> = priorityLayer as TileLayer<any>;
  const url = layer
    ?.getSource()
    ?.getFeatureInfoUrl(evt.coordinate, viewResolution, "EPSG:3857", {
      INFO_FORMAT: "application/json",
    });

  if (!url) return;

  fetch(url)
    .then((response) => response.json())
    .then((data) => {
      const feature = data.features[0];
      if (!feature) {
        popup.setPosition(undefined);
        return;
      }

      displayDetailsPopUp(evt.coordinate, feature.properties);
    });
});

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

    info = info.concat(`${sanitazeKey(key)}: ${sanitazeValue(key, value)}<br>`);
  }

  const popupContent = document.getElementById("popup-content");
  if (popupContent) {
    popupContent.innerHTML = info;
  }

  popup.setPosition(coordinate);
}

function sanitazeKey(key: string) {
  return capitalize(key.replace(/[:_]/g, " "));
}

function sanitazeValue(key: string, value: string | number) {
  if (typeof value === "string") {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  const searchableKey = key.toLocaleLowerCase();
  if (searchableKey.indexOf("area") >= 0) {
    return value < 1000000
      ? `${value} m²`
      : `${(value / 1000000).toFixed(2)} km²`;
  } else if (searchableKey.indexOf("height") >= 0) {
    return `${value} m`;
  }

  return value.toString();
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
