// frontend/src/components/MapComponent.tsx
import React, { useEffect, useRef } from 'react';
import AMapLoader from '@amap/amap-jsapi-loader';

// 假设这是从 LLM 返回的行程数据
interface PlanData {
  daily_plan: {
    day: number;
    activities: {
      location: { name: string; lat: number; lng: number };
    }[];
  }[];
}

interface MapProps {
  plan: PlanData | null;
}

const MapComponent: React.FC<MapProps> = ({ plan }) => {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: any; // AMap.Map 实例
    AMapLoader.load({
      key: import.meta.env.VITE_AMAP_KEY,
      version: '2.0',
      plugins: ['AMap.Marker', 'AMap.Polyline', 'AMap.ToolBar', 'AMap.Scale'],
    })
      .then((AMap) => {
        if (!mapRef.current) return;
        map = new AMap.Map(mapRef.current, {
          zoom: 11,
          center: [116.397428, 39.90923], // 默认北京
        });

        map.addControl(new AMap.ToolBar());
        map.addControl(new AMap.Scale());

        // 清除旧的标记
        map.clearMap();

        if (plan && plan.daily_plan) {
          const markers: any[] = [];
          plan.daily_plan.forEach((day) => {
            day.activities.forEach((activity) => {
              const { lat, lng, name } = activity.location;
              // LLM 返回的经纬度可能是 0.0，需要处理
              if (lat !== 0.0 && lng !== 0.0) {
                const marker = new AMap.Marker({
                  position: [lng, lat],
                  title: name,
                });
                markers.push(marker);
              }
            });
          });
          map.add(markers);

          // 自动缩放到所有标记
          if(markers.length > 0) {
            map.setFitView();
          }
        }
      })
      .catch((e) => {
        console.error(e);
      });

    return () => {
      // 销毁地图
      if (map) {
        map.destroy();
      }
    };
  }, [plan]); // 当 plan 变化时，重新渲染地图标记

  return <div ref={mapRef} style={{ height: '500px', width: '100%' }} />;
};

export default MapComponent;