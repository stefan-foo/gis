import Style from "ol/style/Style";
import { WORKSPACE } from "./constants";
import Icon from "ol/style/Icon";

export const vectorLayerPredefinedStyles: { [key: string]: Style } = {
  [`${WORKSPACE}:highest_peaks`]: new Style({
    image: new Icon({
      anchor: [0.5, 1],
      src: "./res/peak.svg",
      scale: 0.04,
    }),
  }),
  [`${WORKSPACE}:caves`]: new Style({
    image: new Icon({
      anchor: [0.5, 1],
      src: "./res/cave.svg",
      scale: 0.04,
    }),
  }),
};
