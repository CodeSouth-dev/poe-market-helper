"""
Mod Database Handler
Manages storage and retrieval of mod data from SQLite database

Features:
- Store scraped mods from poedb
- Query mods by item class, type, ilvl
- Search mods by name
- Cache frequently accessed data
"""
from sqlalchemy import create_engine, and_, or_
from sqlalchemy.orm import sessionmaker, Session
from typing import List, Dict, Optional, Any
import logging
from pathlib import Path

from .models import Base, Mod, ItemBase, Build, MarketItem

logger = logging.getLogger(__name__)


class ModDatabase:
    def __init__(self, db_path: str = "../data/poe_mods.db"):
        """
        Initialize mod database

        Args:
            db_path: Path to SQLite database file
        """
        # Ensure data directory exists
        db_file = Path(db_path)
        db_file.parent.mkdir(parents=True, exist_ok=True)

        # Create database connection
        self.db_path = f"sqlite:///{db_path}"
        self.engine = create_engine(self.db_path, echo=False)
        self.SessionLocal = sessionmaker(bind=self.engine)

        # Create tables if they don't exist
        Base.metadata.create_all(self.engine)
        logger.info(f"Mod database initialized at: {db_path}")

    def get_session(self) -> Session:
        """Get database session"""
        return self.SessionLocal()

    async def store_mods(self, mods_data: Dict[str, List[Dict]]) -> int:
        """
        Store scraped mods in database

        Args:
            mods_data: Dictionary with 'prefix' and 'suffix' keys containing mod lists

        Returns:
            Total number of mods stored
        """
        session = self.get_session()
        total_stored = 0

        try:
            # Clear existing mods (replace with fresh data)
            session.query(Mod).delete()
            session.commit()

            # Store prefix mods
            for mod_data in mods_data.get('prefix', []):
                mod = Mod(
                    name=mod_data['name'],
                    type='prefix',
                    tier=mod_data.get('tier'),
                    ilvl=mod_data.get('ilvl', 1),
                    tags=mod_data.get('tags', []),
                    item_classes=mod_data.get('item_classes', []),
                    stat_ranges=mod_data.get('stat_ranges', []),
                    source=mod_data.get('source', 'poedb')
                )
                session.add(mod)
                total_stored += 1

            # Store suffix mods
            for mod_data in mods_data.get('suffix', []):
                mod = Mod(
                    name=mod_data['name'],
                    type='suffix',
                    tier=mod_data.get('tier'),
                    ilvl=mod_data.get('ilvl', 1),
                    tags=mod_data.get('tags', []),
                    item_classes=mod_data.get('item_classes', []),
                    stat_ranges=mod_data.get('stat_ranges', []),
                    source=mod_data.get('source', 'poedb')
                )
                session.add(mod)
                total_stored += 1

            session.commit()
            logger.info(f"Stored {total_stored} mods in database")

        except Exception as e:
            session.rollback()
            logger.error(f"Error storing mods: {e}")
            raise
        finally:
            session.close()

        return total_stored

    async def get_mods(
        self,
        item_class: str,
        mod_type: Optional[str] = None,
        min_ilvl: int = 1,
        max_ilvl: int = 100,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get mods filtered by criteria

        Args:
            item_class: Item class (e.g., "Ring", "Body Armour", "universal")
            mod_type: "prefix" or "suffix" (optional, returns both if not specified)
            min_ilvl: Minimum item level
            max_ilvl: Maximum item level
            search: Search term for mod name

        Returns:
            List of mod dictionaries
        """
        session = self.get_session()

        try:
            # Build query
            query = session.query(Mod)

            # Filter by mod type
            if mod_type:
                query = query.filter(Mod.type == mod_type)

            # Filter by ilvl range
            query = query.filter(
                and_(
                    Mod.ilvl >= min_ilvl,
                    Mod.ilvl <= max_ilvl
                )
            )

            # Filter by item class
            # Check if item_classes JSON array contains the specified class or "universal"
            if item_class and item_class.lower() != 'all':
                query = query.filter(
                    or_(
                        Mod.item_classes.contains([item_class]),
                        Mod.item_classes.contains(["universal"])
                    )
                )

            # Search by name
            if search:
                query = query.filter(Mod.name.ilike(f"%{search}%"))

            # Execute query
            mods = query.all()

            # Convert to dictionaries
            return [mod.to_dict() for mod in mods]

        except Exception as e:
            logger.error(f"Error getting mods: {e}")
            raise
        finally:
            session.close()

    async def get_stats(self) -> Dict[str, Any]:
        """
        Get database statistics

        Returns:
            Dictionary with mod counts and other stats
        """
        session = self.get_session()

        try:
            total_mods = session.query(Mod).count()
            prefix_count = session.query(Mod).filter(Mod.type == 'prefix').count()
            suffix_count = session.query(Mod).filter(Mod.type == 'suffix').count()

            return {
                'total_mods': total_mods,
                'prefix_count': prefix_count,
                'suffix_count': suffix_count,
                'last_update': 'N/A'  # TODO: Add timestamp tracking
            }

        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return {
                'total_mods': 0,
                'prefix_count': 0,
                'suffix_count': 0,
                'error': str(e)
            }
        finally:
            session.close()

    async def store_builds(self, builds: List[Dict], league: str) -> int:
        """Store scraped builds in database"""
        session = self.get_session()
        total_stored = 0

        try:
            # Delete old builds for this league
            session.query(Build).filter(Build.league == league).delete()

            # Store new builds
            for build_data in builds:
                build = Build(
                    league=league,
                    name=build_data.get('name'),
                    character_class=build_data.get('class'),
                    level=build_data.get('level'),
                    main_skill=build_data.get('mainSkill'),
                    dps=build_data.get('dps'),
                    life=build_data.get('life'),
                    energy_shield=build_data.get('energyShield'),
                    items=build_data.get('items', []),
                    url=build_data.get('url')
                )
                session.add(build)
                total_stored += 1

            session.commit()
            logger.info(f"Stored {total_stored} builds for league {league}")

        except Exception as e:
            session.rollback()
            logger.error(f"Error storing builds: {e}")
            raise
        finally:
            session.close()

        return total_stored

    async def get_builds(self, league: str, limit: int = 100) -> List[Dict]:
        """Get stored builds for a league"""
        session = self.get_session()

        try:
            builds = session.query(Build).filter(Build.league == league).limit(limit).all()
            return [build.to_dict() for build in builds]
        except Exception as e:
            logger.error(f"Error getting builds: {e}")
            return []
        finally:
            session.close()
