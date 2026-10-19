import { Carousel } from 'antd';
import style from './bannerSlides.module.scss';

const BannerSlides = ({ items, renderExtra }) => {
  if (!items?.length) {
    return null;
  }
  const multiple = items.length > 1;
  return (
    <div className={style.wrap}>
      <Carousel arrows={multiple} dots={multiple}>
        {items.map(item => (
          <div key={item.id}>
            <div className={style.slide}>
              <img src={item.src} alt={item.filename || ''} />
              {renderExtra ? renderExtra(item) : null}
            </div>
          </div>
        ))}
      </Carousel>
    </div>
  );
};

export default BannerSlides;
