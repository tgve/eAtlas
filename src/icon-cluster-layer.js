import {CompositeLayer} from "@deck.gl/core";
import {IconLayer} from "@deck.gl/layers";
import Supercluster from "supercluster";

const MIN_COUNT_TO_RENDER_CLUSTER = 10;

function getIconName(pct) {
  if (pct < 0) {
    // pct is negative when length of a cluster does not meet the min count
    return ``;
  }
  if (pct > 0 && pct < 1) {
    return `marker-<1`;
  }
  return `marker-${pct}`;
}

function getIconSize(size) {
  return Math.min(100, size) / 100 + 1;
}

function getClusterPctForCurrentFilter(clusterItems, filter, filterPrimary) {
  let numerator = 0;
  let denominator = 0;

  if (clusterItems.length < MIN_COUNT_TO_RENDER_CLUSTER) {
    // if there are not enough points in the cluster, make the pct negative
    // this negative value is then handled in getIconName
    return -1;
  }

  // if it is slow, this might be the area to speed up
  clusterItems.forEach(item => {
    numerator += parseInt(item.properties.properties[filter]);
    denominator += parseInt(item.properties.properties[`${filterPrimary}_total_responses`]);
  });

  return numerator / denominator;
}

export default class IconClusterLayer extends CompositeLayer {
  shouldUpdateState({changeFlags}) {
    return changeFlags.somethingChanged;
  }

  updateState({props, oldProps, changeFlags}) {
    const rebuildIndex =
      props.filterSecondary !== oldProps.filterSecondary ||
      changeFlags.dataChanged ||
      props.sizeScale !== oldProps.sizeScale;

    if (rebuildIndex) {
      const index = new Supercluster({maxZoom: 16, radius: props.sizeScale});
      index.load(
        props.data.map(d => ({
          geometry: {coordinates: props.getPosition(d)},
          properties: d
        }))
      );
      this.setState({index});
    }

    const z = Math.floor(this.context.viewport.zoom);
    if (rebuildIndex || z !== this.state.z) {
      this.setState({
        data: this.state.index.getClusters([-180, -85, 180, 85], z),
        z
      });
    }
  }

  getPickingInfo({info, mode}) {
    const pickedObject = info.object && info.object.properties;
    if (pickedObject) {
      if (pickedObject.cluster && mode !== "hover") {
        info.objects = this.state.index.getLeaves(pickedObject.cluster_id, 25).map(f => f.properties);
      }
      info.object = pickedObject;
    }
    return info;
  }

  renderLayers() {
    const {data} = this.state;
    const {iconAtlas, iconMapping, sizeScale, filterPrimary, filterSecondary} = this.props;

    return new IconLayer(
      this.getSubLayerProps({
        id: "icon",
        data,
        iconAtlas,
        iconMapping,
        sizeScale,
        getPosition: d => d.geometry.coordinates,
        getIcon: d => {
          let value = 0;

          const filter = `${filterPrimary}_${filterSecondary}`;

          if (d.properties.cluster) {
            const clusterItems = this.state.index.getLeaves(d.properties.cluster_id);
            value = getClusterPctForCurrentFilter(clusterItems, filter, filterPrimary);
          } else {
            value =
              parseFloat(d.properties.properties[filter]) / d.properties.properties[`${filterPrimary}_total_responses`];
          }

          // this assignment below holds the pct / 100
          value = value * 100;

          // round values above 1, need to preserve decimals between 0 and 1 to render <1
          if (value > 1) {
            value = Math.floor(value);
          }

          return getIconName(value);
        },
        getSize: d => getIconSize(d.properties.cluster ? d.properties.point_count : 1)
      })
    );
  }
}
