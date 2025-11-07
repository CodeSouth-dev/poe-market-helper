"""
SQLAlchemy Database Models for PoE Market Helper

Models:
- Mod: Mod affixes (prefix/suffix)
- ItemBase: Base item types
- Build: Scraped build data
- MarketItem: Market price data
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, JSON, Text
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()


class Mod(Base):
    """Mod affix database model"""
    __tablename__ = 'mods'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, index=True)
    type = Column(String(10), nullable=False, index=True)  # 'prefix' or 'suffix'
    tier = Column(String(50))
    ilvl = Column(Integer, nullable=False, index=True)
    tags = Column(JSON)  # List of tags
    item_classes = Column(JSON)  # List of applicable item classes
    stat_ranges = Column(JSON)  # List of {min, max} stat ranges
    source = Column(String(50), default='poedb')
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """Convert to dictionary"""
        return {
            'id': self.id,
            'name': self.name,
            'type': self.type,
            'tier': self.tier,
            'ilvl': self.ilvl,
            'tags': self.tags or [],
            'item_classes': self.item_classes or [],
            'stat_ranges': self.stat_ranges or [],
            'source': self.source
        }


class ItemBase(Base):
    """Item base types"""
    __tablename__ = 'item_bases'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True, index=True)
    item_class = Column(String(100), nullable=False, index=True)
    base_type = Column(String(100))
    drop_level = Column(Integer)
    implicit_mods = Column(JSON)  # List of implicit mod names
    source = Column(String(50), default='poedb')
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'item_class': self.item_class,
            'base_type': self.base_type,
            'drop_level': self.drop_level,
            'implicit_mods': self.implicit_mods or [],
            'source': self.source
        }


class Build(Base):
    """Scraped build data from poe.ninja"""
    __tablename__ = 'builds'

    id = Column(Integer, primary_key=True, autoincrement=True)
    league = Column(String(100), nullable=False, index=True)
    name = Column(String(255))
    character_class = Column(String(50), index=True)
    level = Column(Integer)
    main_skill = Column(String(100), index=True)
    dps = Column(Integer)
    life = Column(Integer)
    energy_shield = Column(Integer)
    items = Column(JSON)  # List of equipped items
    url = Column(String(500))
    snapshot_timestamp = Column(DateTime)  # When build was captured
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'league': self.league,
            'name': self.name,
            'class': self.character_class,
            'level': self.level,
            'mainSkill': self.main_skill,
            'dps': self.dps,
            'life': self.life,
            'energyShield': self.energy_shield,
            'items': self.items or [],
            'url': self.url,
            'timestamp': self.snapshot_timestamp.isoformat() if self.snapshot_timestamp else None
        }


class MarketItem(Base):
    """Market price data from poe.ninja"""
    __tablename__ = 'market_items'

    id = Column(Integer, primary_key=True, autoincrement=True)
    league = Column(String(100), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    category = Column(String(100), index=True)  # 'currency', 'unique', etc.
    base_type = Column(String(100))
    chaos_value = Column(Float)
    divine_value = Column(Float)
    exalted_value = Column(Float)
    listing_count = Column(Integer)
    spark_line = Column(JSON)  # Price history
    low_confidence = Column(Boolean, default=False)
    snapshot_timestamp = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'league': self.league,
            'name': self.name,
            'category': self.category,
            'baseType': self.base_type,
            'chaosValue': self.chaos_value,
            'divineValue': self.divine_value,
            'exaltedValue': self.exalted_value,
            'listingCount': self.listing_count,
            'sparkLine': self.spark_line,
            'lowConfidence': self.low_confidence,
            'timestamp': self.snapshot_timestamp.isoformat() if self.snapshot_timestamp else None
        }
