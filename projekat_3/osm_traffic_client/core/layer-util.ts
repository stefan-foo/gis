import TileLayer from "ol/layer/Tile";
import { GEOSERVER_URI, WORKSPACE } from "../constants";
import { Attribute } from "../model/attribute";
import { DataType } from "../model/data-type";
import { LayerInfo } from "../model/layer-info";
import { TileWMS } from "ol/source";
import { WMSCapabilities } from "ol/format";
import { ViewParam } from "../model/view-param";
import { ParamDataType } from "../model/param-data-type";
import { ParamsPanel } from "./ParamsPanel";

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
  console.log(capabilities);

  const layers: LayerInfo[] = capabilities.Capability.Layer.Layer?.map(
    (responseLayer: any) => {
      console.log(responseLayer);
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
  console.log("refresh");
  return new TileLayer({
    source: new TileWMS({
      attributions: "@geoserver",
      url: `${GEOSERVER_URI}/${WORKSPACE}/wms?`,
      params: {
        LAYERS: `${WORKSPACE}:${layer.name}`,
        TILED: true,
        VIEWPARAMS: paramsPanel?.paramString,
      },
      serverType: "geoserver",
      transition: 0,
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
