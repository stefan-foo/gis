import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import { TileWMS } from "ol/source";
import VectorSource from "ol/source/Vector";
import GeoJSON from "ol/format/GeoJSON.js";
import { bbox as bboxStrategy } from "ol/loadingstrategy.js";
import { LayerInfo } from "./model/layer-info";
import { WMSCapabilities } from "ol/format";
import { GEOSERVER_URI, WORKSPACE } from "./constants";

export async function getWFSLayersInfo(): Promise<LayerInfo[]> {
  const response = await fetch(
    `${GEOSERVER_URI}/${WORKSPACE}/wfs?request=GetCapabilities&service=WFS&AcceptFormats=application/json`
  );
  const xmlText = await response.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  const featureElements = xmlDoc.getElementsByTagName("FeatureType");
  //@ts-ignore
  return Array.from(featureElements).map((featureElement) => {
    const name = featureElement.getElementsByTagName("Name")[0].textContent;
    const title = featureElement.getElementsByTagName("Title")[0].textContent;
    return { name: name, title: title, type: "WFS" };
  });
}

export async function getWMSLayersInfo(): Promise<LayerInfo[]> {
  const response = await fetch(
    `${GEOSERVER_URI}/${WORKSPACE}/wms?request=GetCapabilities&service=WMS`
  );

  const text = await response.text();
  const capabilities = new WMSCapabilities().read(text);

  const layers: LayerInfo[] = capabilities.Capability.Layer.Layer?.map(
    (responseLayer: any) => ({
      name: responseLayer.Name,
      title: responseLayer.Title,
      service: "WMS",
    })
  );

  return layers;
}

export function createVectorLayer(layer: LayerInfo): VectorLayer<any> {
  return new VectorLayer({
    source: new VectorSource({
      format: new GeoJSON(),
      url: function (extent) {
        return `${GEOSERVER_URI}/${WORKSPACE}/wfs?service=WFS&request=GetFeature&typename=${
          layer.name
        }&outputFormat=application/json&srsname=EPSG:3857&bbox=${extent.join(
          ","
        )},EPSG:3857`;
      },
      strategy: bboxStrategy,
    }),
  });
}

export function createTileLayer(layer: LayerInfo): TileLayer<TileWMS> {
  return new TileLayer({
    source: new TileWMS({
      attributions: "@geoserver",
      url: `${GEOSERVER_URI}/${WORKSPACE}/wms?`,
      params: {
        LAYERS: `${WORKSPACE}:${layer.name}`,
        TILED: true,
      },
      serverType: "geoserver",
      transition: 0,
    }),
  });
}
