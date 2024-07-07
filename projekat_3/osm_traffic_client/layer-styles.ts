import Style from "ol/style/Style";
import { WORKSPACE } from "./constants";
import Icon from "ol/style/Icon";
import Stroke from "ol/style/Stroke";

export const styles: { [key: string]: (f: any, r: any) => Style | Style } = {
  [`${WORKSPACE}:gps_tracking_data`]: function (feature, resolution) {
    const zoom = Math.log2(156543 / resolution);
    let scale = 0.027 * (1 + zoom / 10);

    return new Style({
      image: new Icon({
        src: "./res/car_top.svg",
        rotation: (feature.get("angle") * Math.PI) / 180,
        rotateWithView: true,
        scale: scale,
      }),
    });
  },
  [`${WORKSPACE}:gps_tracking_summary`]: function () {
    return new Style({
      stroke: new Stroke({
        color: "rgba(255, 0, 0, 0.7)",
        width: 3,
      }),
    });
  },
  [`${WORKSPACE}:road_number_of_vehicles`]: function () {
    return new Style({
      stroke: new Stroke({
        width: 3,
      }),
    });
  },
  [`${WORKSPACE}:traffic_lights`]: function (feature, resolution) {
    return new Style({
      image: new Icon({
        src: "./res/traffic-lights-10.svg",
        scale: 0.02,
      }),
    });
  },
};
