import { GeoJSON, WMSCapabilities } from "ol/format";
import ImageLayer from "ol/layer/Image";
import TileLayer from "ol/layer/Tile";
import VectorLayer from "ol/layer/Vector";
import { bbox as bboxStrategy } from "ol/loadingstrategy";
import { ImageWMS, TileWMS } from "ol/source";
import VectorSource from "ol/source/Vector";
import { GEOSERVER_URI, WORKSPACE } from "../constants";
import { getStyle, styles } from "../layer-styles";
import { Attribute } from "../model/attribute";
import { DataType } from "../model/data-type";
import { LayerInfo } from "../model/layer-info";
import { ParamDataType } from "../model/param-data-type";
import { ViewParam } from "../model/view-param";
import { FilterPanel } from "./FilterPanel";
import { ParamsPanel } from "./ParamsPanel";
import { getCql } from "./filter-util";

export async function getWFSLayersInfo(): Promise<LayerInfo[]> {
  const wfsCapabilitiesResponse = await fetch(
    `${GEOSERVER_URI}/${WORKSPACE}/wfs?request=GetCapabilities&service=WFS`
  );

  const xmlText = await wfsCapabilitiesResponse.text();
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  const featureElements = xmlDoc.getElementsByTagName("FeatureType");

  return Promise.all(
    Array.from(featureElements).map(async (feature) => {
      const name = feature.getElementsByTagName("Name")[0].textContent;
      const title = feature.getElementsByTagName("Title")[0].textContent;

      const describeFeatureTypeResponse = await fetch(
        `${GEOSERVER_URI}/${WORKSPACE}/wfs?service=WFS&request=DescribeFeatureType&typeName=${name}`
      );

      const describeDoc = parser.parseFromString(
        await describeFeatureTypeResponse.text(),
        "text/xml"
      );
      const kws = Array.from(feature.getElementsByTagName("ows:Keyword"))
        .map((el) => el.textContent ?? "")
        .filter((e) => e !== "");

      const attributeElements = describeDoc.getElementsByTagName("xsd:element");
      return {
        service: "WFS",
        name: name ?? "",
        title: title ?? "",
        viewParams: parseViewParams(kws),
        keywords: kws,
        attributes: Array.from(attributeElements)
          .map((attrElement) => {
            const type = attrElement.getAttribute("type");
            return {
              name: attrElement.getAttribute("name") ?? "",
              dataType: Object.values(DataType).includes(type as DataType)
                ? (type as DataType)
                : DataType.Unknown,
            };
          })
          .filter(
            (e): e is Attribute =>
              e.name !== "" && e.dataType !== DataType.Unknown
          ),
      };
    })
  );
}

export async function getWMSLayersInfo(): Promise<LayerInfo[]> {
  const wmsCapabilitiesResponse = await fetch(
    `${GEOSERVER_URI}/${WORKSPACE}/wms?request=GetCapabilities&service=WMS`
  );

  const text = await wmsCapabilitiesResponse.text();
  const capabilities = new WMSCapabilities().read(text);

  const layers: LayerInfo[] = capabilities.Capability.Layer.Layer?.map(
    (responseLayer: any) => {
      return {
        name: responseLayer.Name,
        title: responseLayer.Title,
        service: "WMS",
        keywords: responseLayer.KeywordList,
        viewParams: parseViewParams(responseLayer.KeywordList),
      };
    }
  );

  return layers;
}

export function createTileLayer(
  layer: LayerInfo,
  paramsPanel: ParamsPanel | null
): TileLayer<TileWMS> {
  const params: any = {
    LAYERS: `${WORKSPACE}:${layer.name}`,
    TILED: true,
  };
  if (paramsPanel?.paramString) {
    params.VIEWPARAMS = paramsPanel?.paramString;
  }

  return new TileLayer({
    source: new TileWMS({
      attributions: "@geoserver",
      url: `${GEOSERVER_URI}/${WORKSPACE}/wms?`,
      params: params,
      serverType: "geoserver",
    }),
  });
}

export function createImageLayer(
  layer: LayerInfo,
  paramsPanel: ParamsPanel | null
): ImageLayer<ImageWMS> {
  const params: any = {
    LAYERS: `${WORKSPACE}:${layer.name}`,
    TILED: true,
  };
  if (paramsPanel?.paramString) {
    params.VIEWPARAMS = paramsPanel?.paramString;
  }

  return new ImageLayer({
    source: new ImageWMS({
      attributions: "@geoserver",
      url: `${GEOSERVER_URI}/${WORKSPACE}/wms?`,
      params: params,
      serverType: "geoserver",
    }),
  });
}

export function parseViewParams(keywords: string[]): ViewParam[] {
  return keywords
    .filter((kw) => kw.startsWith("view_param"))
    .map((kw) => {
      const split = kw.split(";");
      return {
        name: split[1],
        dataType: split[2] as ParamDataType,
      };
    });
}

export function createVectorLayer(
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
    style: getStyle(layer.name),
  });
}
